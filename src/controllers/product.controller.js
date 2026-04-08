const mongoose = require('mongoose');
const Product = require('../models/Product');

const assignProductFields = (product, payload = {}) => {
  const allowedFields = [
    'name',
    'description',
    'shortDescription',
    'priceDisplay',
    'price',
    'discountPrice',
    'stock',
    'sku',
    'category',
    'mainImage',
    'images',
    'specifications',
    'tags',
    'unit',
    'hsn',
    'isFeatured',
    'isActive',
    'rating',
  ];

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      product[field] = payload[field];
    }
  });

  if (payload.images !== undefined) {
    product.images = Array.isArray(payload.images) ? payload.images : [];
  }

  if (payload.tags !== undefined) {
    product.tags = Array.isArray(payload.tags) ? payload.tags : [];
  }

  if (payload.category === null || payload.category === '') {
    product.category = undefined;
  }

  if ((!product.mainImage || !product.mainImage.trim()) && Array.isArray(product.images) && product.images[0]) {
    product.mainImage = product.images[0];
  }
};

/**
 * Get all products for public display
 * Simplified: No categories, no complex pagination
 */
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get single product by slug
 */
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug, isActive: true }).select('-__v');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, data: { product } });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get all products for admin
 */
const getAdminProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error('Admin Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create a new product
 */
const createProduct = async (req, res) => {
  try {
    const { name, priceDisplay } = req.body;

    if (!name || !priceDisplay) {
      return res.status(400).json({ success: false, message: 'Name and Price are required' });
    }

    const product = new Product({
      createdBy: req.user.userId,
      isActive: req.body.isActive !== false,
    });

    assignProductFields(product, req.body);
    await product.save();

    res.status(201).json({ success: true, data: { product } });
  } catch (error) {
    console.error('Create Product Error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Product with this name/slug already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update an existing product
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    assignProductFields(product, req.body);
    await product.save();

    res.status(200).json({ success: true, data: { product } });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Delete a product
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Search (Simplified)
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });

    const products = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).limit(20);

    res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts
};
