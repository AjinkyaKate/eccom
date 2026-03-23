const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const { generateOrderNumber, generateInvoiceNumber } = require('../utils/orderNumber.util');
const { validatePhoneNumber, formatPhoneNumber } = require('../utils/otp.util');

const AVAILABLE_PAYMENT_METHODS = ['COD'];
const BLOCKING_CHECKOUT_ISSUES = new Set(['empty_cart', 'product_unavailable', 'insufficient_stock']);

const ORDER_STATUS_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'delivered'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

const PAYMENT_STATUS_TRANSITIONS = {
  pending: ['paid', 'failed'],
  failed: ['pending', 'paid'],
  paid: ['refunded'],
  refunded: [],
};

const CUSTOMER_CANCELABLE_STATUSES = new Set(['placed', 'confirmed']);
const ADMIN_CANCELABLE_STATUSES = new Set(['placed', 'confirmed', 'packed']);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCurrentProductPrice = (product) => {
  if (product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price) {
    return product.discountPrice;
  }

  return product.price;
};

const normalizeAddressSnapshot = (address = {}, user = null) => {
  const normalizedPhone = address.phone
    ? formatPhoneNumber(address.phone.toString())
    : user?.phone
      ? formatPhoneNumber(user.phone)
      : '';

  return {
    sourceAddressId: address.sourceAddressId || address._id || undefined,
    type: address.type || 'other',
    name: (address.name || user?.name || 'Customer').toString().trim(),
    businessName: address.businessName ? address.businessName.toString().trim() : undefined,
    phone: normalizedPhone,
    street: address.street ? address.street.toString().trim() : '',
    city: address.city ? address.city.toString().trim() : '',
    state: address.state ? address.state.toString().trim() : '',
    pincode: address.pincode ? address.pincode.toString().trim() : '',
    landmark: address.landmark ? address.landmark.toString().trim() : undefined,
    formattedAddress: address.formattedAddress
      ? address.formattedAddress.toString().trim()
      : undefined,
    placeId: address.placeId ? address.placeId.toString().trim() : undefined,
    latitude:
      address.latitude !== undefined && address.latitude !== null ? Number(address.latitude) : undefined,
    longitude:
      address.longitude !== undefined && address.longitude !== null ? Number(address.longitude) : undefined,
    deliveryInstructions: address.deliveryInstructions
      ? address.deliveryInstructions.toString().trim()
      : undefined,
  };
};

const validateShippingAddress = (address) => {
  const requiredFields = ['name', 'phone', 'street', 'city', 'state', 'pincode'];
  const missingField = requiredFields.find(
    (field) => !address[field] || address[field].toString().trim() === ''
  );

  if (missingField) {
    return `${missingField} is required`;
  }

  if (!validatePhoneNumber(address.phone)) {
    return 'Invalid shipping phone number format';
  }

  return null;
};

const resolveShippingAddress = async (user, body = {}) => {
  const { shippingAddressId, shippingAddress } = body;

  if (shippingAddressId) {
    if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
      return { error: 'Invalid shippingAddressId' };
    }

    const selectedAddress = user.addresses.id(shippingAddressId);

    if (!selectedAddress) {
      return { error: 'Selected shipping address not found' };
    }

    const snapshot = normalizeAddressSnapshot(selectedAddress.toObject(), user);
    const validationError = validateShippingAddress(snapshot);

    if (validationError) {
      return { error: validationError };
    }

    return { address: snapshot };
  }

  if (shippingAddress) {
    const snapshot = normalizeAddressSnapshot(shippingAddress, user);
    const validationError = validateShippingAddress(snapshot);

    if (validationError) {
      return { error: validationError };
    }

    return { address: snapshot };
  }

  if (user.addresses.length > 0) {
    const defaultAddress = user.addresses.find((address) => address.isDefault) || user.addresses[0];
    const snapshot = normalizeAddressSnapshot(defaultAddress.toObject(), user);
    const validationError = validateShippingAddress(snapshot);

    if (!validationError) {
      return { address: snapshot };
    }
  }

  return {
    error: 'A valid shipping address or shippingAddressId is required',
  };
};

const getSavedAddressesForResponse = (user) => {
  return user.addresses.map((address) => {
    const normalized = normalizeAddressSnapshot(address.toObject(), user);

    return {
      id: address._id,
      ...normalized,
      isDefault: Boolean(address.isDefault),
    };
  });
};

const loadCheckoutContext = async (userId) => {
  const [user, cart] = await Promise.all([
    User.findById(userId).select('phone name email addresses'),
    Cart.findOne({ user: userId }).populate(
      'items.product',
      'name slug sku mainImage price discountPrice stock isActive'
    ),
  ]);

  if (!user) {
    return {
      error: 'User not found',
    };
  }

  if (!cart || cart.items.length === 0) {
    return {
      user,
      cart: null,
      items: [],
      pricing: {
        subtotal: 0,
        shippingCharges: 0,
        discount: 0,
        total: 0,
      },
      issues: [
        {
          code: 'empty_cart',
          message: 'Cart is empty',
        },
      ],
      canCheckout: false,
      savedAddresses: getSavedAddressesForResponse(user),
    };
  }

  const issues = [];
  const removableIds = [];
  const items = [];

  cart.items.forEach((item) => {
    if (!item.product || !item.product.isActive) {
      removableIds.push(item._id);
      issues.push({
        code: 'product_unavailable',
        itemId: item._id,
        productId: item.product?._id,
        message: 'One or more products in the cart are no longer available',
      });
      return;
    }

    const currentPrice = getCurrentProductPrice(item.product);
    const itemData = {
      cartItemId: item._id,
      productId: item.product._id,
      name: item.product.name,
      slug: item.product.slug,
      sku: item.product.sku,
      image: item.product.mainImage,
      quantity: item.quantity,
      unitPrice: currentPrice,
      previousUnitPrice: item.price,
      subtotal: currentPrice * item.quantity,
      stock: item.product.stock,
      hasPriceChanged: item.price !== currentPrice,
    };

    if (itemData.hasPriceChanged) {
      issues.push({
        code: 'price_changed',
        itemId: item._id,
        productId: item.product._id,
        message: `${item.product.name} price changed from ${item.price} to ${currentPrice}`,
      });
    }

    if (item.quantity > item.product.stock) {
      issues.push({
        code: 'insufficient_stock',
        itemId: item._id,
        productId: item.product._id,
        message: `${item.product.name} has only ${item.product.stock} units in stock`,
      });
    }

    items.push(itemData);
  });

  if (removableIds.length > 0) {
    cart.items.pull(...removableIds);
    await cart.save();
  }

  const pricing = {
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    shippingCharges: 0,
    discount: 0,
  };
  pricing.total = Math.max(0, pricing.subtotal + pricing.shippingCharges - pricing.discount);

  const canCheckout =
    items.length > 0 && !issues.some((issue) => BLOCKING_CHECKOUT_ISSUES.has(issue.code));

  return {
    user,
    cart,
    items,
    pricing,
    issues,
    canCheckout,
    savedAddresses: getSavedAddressesForResponse(user),
  };
};

const createUniqueOrderNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = generateOrderNumber();
    const existingOrder = await Order.exists({ orderNumber });

    if (!existingOrder) {
      return orderNumber;
    }
  }

  throw new Error('Unable to generate a unique order number');
};

const createUniqueInvoiceNumber = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = generateInvoiceNumber();
    const existingOrder = await Order.exists({ 'invoice.invoiceNumber': invoiceNumber });

    if (!existingOrder) {
      return invoiceNumber;
    }
  }

  throw new Error('Unable to generate a unique invoice number');
};

const buildOrderWriteOperations = async ({ order, cart, checkoutItems }) => {
  const applyInventoryUpdate = async (session = null) => {
    for (const item of checkoutItems) {
      const query = {
        _id: item.productId,
        isActive: true,
        stock: { $gte: item.quantity },
      };

      const update = {
        $inc: {
          stock: -item.quantity,
          soldCount: item.quantity,
        },
      };

      const result = session
        ? await Product.updateOne(query, update, { session })
        : await Product.updateOne(query, update);

      if (result.modifiedCount !== 1) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
    }
  };

  const runWithTransaction = async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await applyInventoryUpdate(session);
        await order.save({ session });
        cart.items = [];
        await cart.save({ session });
      });
    } finally {
      await session.endSession();
    }
  };

  const runWithoutTransaction = async () => {
    const completedUpdates = [];

    try {
      for (const item of checkoutItems) {
        const result = await Product.updateOne(
          {
            _id: item.productId,
            isActive: true,
            stock: { $gte: item.quantity },
          },
          {
            $inc: {
              stock: -item.quantity,
              soldCount: item.quantity,
            },
          }
        );

        if (result.modifiedCount !== 1) {
          throw new Error(`Insufficient stock for ${item.name}`);
        }

        completedUpdates.push(item);
      }

      await order.save();
      cart.items = [];
      await cart.save();
    } catch (error) {
      if (completedUpdates.length > 0) {
        await Promise.all(
          completedUpdates.map((item) =>
            Product.updateOne(
              { _id: item.productId },
              {
                $inc: {
                  stock: item.quantity,
                  soldCount: -item.quantity,
                },
              }
            )
          )
        );
      }

      throw error;
    }
  };

  try {
    await runWithTransaction();
  } catch (error) {
    const transactionUnsupported =
      error.message.includes('Transaction numbers are only allowed on a replica set member') ||
      error.message.includes('Transaction support is not available');

    if (!transactionUnsupported) {
      throw error;
    }

    await runWithoutTransaction();
  }
};

const setOrderStatusTimestamps = (order, nextStatus) => {
  const now = new Date();

  if (nextStatus === 'confirmed' && !order.confirmedAt) {
    order.confirmedAt = now;
  }

  if (nextStatus === 'packed' && !order.packedAt) {
    order.packedAt = now;
  }

  if (nextStatus === 'dispatched' && !order.dispatchedAt) {
    order.dispatchedAt = now;
  }

  if (nextStatus === 'in_transit' && !order.inTransitAt) {
    order.inTransitAt = now;
  }

  if (nextStatus === 'delivered' && !order.deliveredAt) {
    order.deliveredAt = now;
  }

  if (nextStatus === 'cancelled' && !order.cancelledAt) {
    order.cancelledAt = now;
  }
};

const canTransitionOrderStatus = (currentStatus, nextStatus) => {
  return (ORDER_STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
};

const canTransitionPaymentStatus = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return true;
  }

  return (PAYMENT_STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
};

const restoreOrderInventory = async (order) => {
  if (order.stockRestoredAt) {
    return;
  }

  await Promise.all(
    order.items.map((item) =>
      Product.updateOne(
        { _id: item.product },
        {
          $inc: {
            stock: item.quantity,
            soldCount: -item.quantity,
          },
        }
      )
    )
  );

  order.stockRestoredAt = new Date();
};

const getCheckoutSummary = async (req, res) => {
  try {
    const summary = await loadCheckoutContext(req.user.userId);

    if (summary.error) {
      return res.status(404).json({
        success: false,
        message: summary.error,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        checkout: {
          items: summary.items,
          pricing: summary.pricing,
          issues: summary.issues,
          canCheckout: summary.canCheckout,
          availablePaymentMethods: AVAILABLE_PAYMENT_METHODS,
          savedAddresses: summary.savedAddresses,
        },
      },
    });
  } catch (error) {
    console.error('Get Checkout Summary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const checkout = async (req, res) => {
  try {
    const summary = await loadCheckoutContext(req.user.userId);

    if (summary.error) {
      return res.status(404).json({
        success: false,
        message: summary.error,
      });
    }

    if (!summary.canCheckout) {
      return res.status(409).json({
        success: false,
        message: 'Cart has issues. Please review cart before checkout.',
        data: {
          checkout: {
            items: summary.items,
            pricing: summary.pricing,
            issues: summary.issues,
            canCheckout: false,
            availablePaymentMethods: AVAILABLE_PAYMENT_METHODS,
            savedAddresses: summary.savedAddresses,
          },
        },
      });
    }

    const paymentMethod = (req.body.paymentMethod || 'COD').toString().trim().toUpperCase();

    if (!AVAILABLE_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Payment method must be one of: ${AVAILABLE_PAYMENT_METHODS.join(', ')}`,
      });
    }

    const { address, error: addressError } = await resolveShippingAddress(summary.user, req.body);

    if (addressError) {
      return res.status(400).json({
        success: false,
        message: addressError,
      });
    }

    const orderNumber = await createUniqueOrderNumber();
    const customerNotes =
      typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : undefined;

    const order = new Order({
      orderNumber,
      customer: {
        user: summary.user._id,
        phone: summary.user.phone,
        name: summary.user.name,
        email: summary.user.email,
      },
      items: summary.items.map((item) => ({
        product: item.productId,
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        price: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        image: item.image,
      })),
      shippingAddress: address,
      pricing: summary.pricing,
      payment: {
        method: paymentMethod,
        status: paymentMethod === 'COD' ? 'pending' : 'pending',
        lastUpdatedAt: new Date(),
      },
      paymentHistory: [
        {
          status: 'pending',
          note: paymentMethod === 'COD' ? 'Cash on delivery selected' : 'Payment initiated',
          updatedBy: summary.user._id,
          updatedByRole: 'customer',
        },
      ],
      status: 'placed',
      statusHistory: [
        {
          status: 'placed',
          note: 'Order placed by customer',
          updatedBy: summary.user._id,
          updatedByRole: 'customer',
        },
      ],
      source: 'website',
      customerNotes,
    });

    await buildOrderWriteOperations({
      order,
      cart: summary.cart,
      checkoutItems: summary.items,
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('Checkout Error:', error);

    if (error.message.startsWith('Insufficient stock for ')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      'customer.user': req.user.userId,
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      filter['payment.status'] = req.query.paymentStatus;
    }

    const [orders, totalItems] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'orderNumber status pricing payment totalItems createdAt deliveredAt cancelledAt items shippingAddress'
        ),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: buildPaginationMeta({ page, limit, totalItems }),
      },
    });
  } catch (error) {
    console.error('Get My Orders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
      });
    }

    const order = await Order.findOne({
      _id: id,
      'customer.user': req.user.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('Get My Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const reason =
      typeof req.body.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : 'Cancelled by customer';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
      });
    }

    const order = await Order.findOne({
      _id: id,
      'customer.user': req.user.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!CUSTOMER_CANCELABLE_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'This order can no longer be cancelled from the customer side',
      });
    }

    await restoreOrderInventory(order);
    order.status = 'cancelled';
    setOrderStatusTimestamps(order, 'cancelled');
    order.statusHistory.push({
      status: 'cancelled',
      note: reason,
      updatedBy: req.user.userId,
      updatedByRole: 'customer',
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const buildAdminOrderFilter = (query = {}) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentStatus) {
    filter['payment.status'] = query.paymentStatus;
  }

  if (query.customerId && mongoose.Types.ObjectId.isValid(query.customerId)) {
    filter['customer.user'] = new mongoose.Types.ObjectId(query.customerId);
  }

  if (query.date) {
    const date = new Date(query.date);

    if (!Number.isNaN(date.getTime())) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }
  }

  const normalizedSearch = typeof query.search === 'string' ? query.search.trim() : '';

  if (normalizedSearch) {
    const searchRegex = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [
      { orderNumber: searchRegex },
      { 'customer.phone': searchRegex },
      { 'customer.name': searchRegex },
      { 'customer.email': searchRegex },
      { 'shippingAddress.name': searchRegex },
      { 'shippingAddress.businessName': searchRegex },
    ];
  }

  return filter;
};

const buildAdminOrderStats = async () => {
  const statuses = ['placed', 'confirmed', 'packed', 'dispatched', 'in_transit', 'delivered', 'cancelled'];
  const counts = await Promise.all(statuses.map((status) => Order.countDocuments({ status })));
  const paymentPending = await Order.countDocuments({ 'payment.status': 'pending' });

  return statuses.reduce(
    (summary, status, index) => {
      summary[status] = counts[index];
      return summary;
    },
    {
      total: counts.reduce((sum, count) => sum + count, 0),
      paymentPending,
    }
  );
};

const getAdminOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildAdminOrderFilter(req.query);

    const [orders, totalItems, stats] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'orderNumber customer status pricing payment source createdAt confirmedAt packedAt dispatchedAt deliveredAt cancelledAt'
        ),
      Order.countDocuments(filter),
      buildAdminOrderStats(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        stats,
        pagination: buildPaginationMeta({ page, limit, totalItems }),
      },
    });
  } catch (error) {
    console.error('Get Admin Orders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getAdminOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const [recentOrders, totalOrders] = await Promise.all([
      Order.find({
        'customer.user': order.customer.user,
        _id: { $ne: order._id },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber status pricing payment createdAt deliveredAt cancelledAt'),
      Order.countDocuments({
        'customer.user': order.customer.user,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        order,
        customerHistory: {
          totalOrders,
          recentOrders,
        },
      },
    });
  } catch (error) {
    console.error('Get Admin Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const nextStatus = typeof req.body.status === 'string' ? req.body.status.trim() : '';
    const note =
      typeof req.body.note === 'string' && req.body.note.trim()
        ? req.body.note.trim()
        : `Order marked as ${nextStatus}`;

    if (!Object.prototype.hasOwnProperty.call(ORDER_STATUS_TRANSITIONS, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition order from ${order.status} to ${nextStatus}`,
      });
    }

    if (nextStatus === 'cancelled') {
      if (!ADMIN_CANCELABLE_STATUSES.has(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'This order can no longer be cancelled',
        });
      }

      await restoreOrderInventory(order);
    }

    order.status = nextStatus;
    setOrderStatusTimestamps(order, nextStatus);
    order.statusHistory.push({
      status: nextStatus,
      note,
      updatedBy: req.user.userId,
      updatedByRole: 'admin',
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('Update Order Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const updateOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const nextStatus = typeof req.body.status === 'string' ? req.body.status.trim() : '';
    const note =
      typeof req.body.note === 'string' && req.body.note.trim()
        ? req.body.note.trim()
        : `Payment marked as ${nextStatus}`;
    const referenceId =
      typeof req.body.referenceId === 'string' && req.body.referenceId.trim()
        ? req.body.referenceId.trim()
        : undefined;
    const paidAmount =
      req.body.paidAmount !== undefined && req.body.paidAmount !== null ? Number(req.body.paidAmount) : undefined;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id',
      });
    }

    if (!['pending', 'paid', 'failed', 'refunded'].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Payment status must be pending, paid, failed, or refunded',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!canTransitionPaymentStatus(order.payment.status, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition payment from ${order.payment.status} to ${nextStatus}`,
      });
    }

    order.payment.status = nextStatus;
    order.payment.referenceId = referenceId || order.payment.referenceId;
    order.payment.lastUpdatedAt = new Date();

    if (nextStatus === 'paid') {
      order.payment.paidAt = new Date();
      order.payment.paidAmount =
        paidAmount !== undefined && !Number.isNaN(paidAmount) ? paidAmount : order.pricing.total;

      if (!order.invoice.isGenerated) {
        order.invoice = {
          isGenerated: true,
          invoiceNumber: await createUniqueInvoiceNumber(),
          generatedAt: new Date(),
          amount: order.payment.paidAmount,
          sharedOnWhatsAppAt: null,
        };
      }
    } else if (paidAmount !== undefined && !Number.isNaN(paidAmount)) {
      order.payment.paidAmount = paidAmount;
    }

    order.paymentHistory.push({
      status: nextStatus,
      note,
      referenceId,
      amount: order.payment.paidAmount,
      updatedBy: req.user.userId,
      updatedByRole: 'admin',
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order payment updated successfully',
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('Update Order Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getCheckoutSummary,
  checkout,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderPayment,
};
