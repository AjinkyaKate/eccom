const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const getCurrentProductPrice = (product) => {
  if (product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price) {
    return product.discountPrice;
  }

  return product.price;
};

const formatCart = (cart) => {
  const items = cart.items
    .filter((item) => item.product)
    .map((item) => ({
      id: item._id,
      product: {
        id: item.product._id,
        name: item.product.name,
        slug: item.product.slug,
        mainImage: item.product.mainImage,
        price: getCurrentProductPrice(item.product),
        stock: item.product.stock,
      },
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      addedAt: item.addedAt,
    }));

  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  };
};

const populateCart = (query) =>
  query.populate('items.product', 'name slug mainImage price discountPrice stock isActive');

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  return cart;
};

const sanitizeCartItems = (cart) => {
  const originalLength = cart.items.length;

  cart.items = cart.items.filter((item) => item.product && item.product.isActive);

  return cart.items.length !== originalLength;
};

const getCart = async (req, res) => {
  try {
    let cart = await populateCart(Cart.findOne({ user: req.user.userId }));

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: {
            items: [],
            subtotal: 0,
            totalItems: 0,
          },
        },
      });
    }

    const changed = sanitizeCartItems(cart);
    if (changed) {
      await cart.save();
      cart = await populateCart(Cart.findById(cart._id));
    }

    res.status(200).json({
      success: true,
      data: {
        cart: formatCart(cart),
      },
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const parsedQuantity = Number(quantity);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid productId is required',
      });
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const cart = await getOrCreateCart(req.user.userId);
    const existingItem = cart.items.find((item) => item.product.toString() === productId);
    const snapshotPrice = getCurrentProductPrice(product);

    if (existingItem) {
      existingItem.quantity = existingItem.quantity + parsedQuantity;
      existingItem.price = snapshotPrice;
    } else {
      cart.items.push({
        product: product._id,
        quantity: parsedQuantity,
        price: snapshotPrice,
      });
    }

    await cart.save();

    const populatedCart = await populateCart(Cart.findById(cart._id));

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      data: {
        cart: formatCart(populatedCart),
      },
    });
  } catch (error) {
    console.error('Add To Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const parsedQuantity = Number(quantity);

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item id',
      });
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    const cart = await getOrCreateCart(req.user.userId);
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }

    const product = await Product.findById(item.product);

    if (!product || !product.isActive) {
      cart.items.pull(itemId);
      await cart.save();

      return res.status(404).json({
        success: false,
        message: 'Product not available anymore',
      });
    }

    item.quantity = parsedQuantity;
    item.price = getCurrentProductPrice(product);

    await cart.save();

    const populatedCart = await populateCart(Cart.findById(cart._id));

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      data: {
        cart: formatCart(populatedCart),
      },
    });
  } catch (error) {
    console.error('Update Cart Item Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item id',
      });
    }

    const cart = await getOrCreateCart(req.user.userId);
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }

    cart.items.pull(itemId);
    await cart.save();

    const populatedCart = await populateCart(Cart.findById(cart._id));

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: {
        cart: formatCart(populatedCart),
      },
    });
  } catch (error) {
    console.error('Remove Cart Item Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.userId);
    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
