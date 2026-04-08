const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const BusinessSettings = require('../models/BusinessSettings');
const PaymentLink = require('../models/PaymentLink');
const WhatsAppLog = require('../models/WhatsAppLog');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const { generateOrderNumber, generateInvoiceNumber } = require('../utils/orderNumber.util');
const { validatePhoneNumber, formatPhoneNumber } = require('../utils/otp.util');
const { generateInvoicePdf } = require('../services/invoice.service');
const { addDebit, checkOrderBlock } = require('../services/ledger.service');
const { createPaymentLink } = require('../services/razorpay.service');
const { sendPaymentConfirmation } = require('../services/billing.whatsapp.service');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const AVAILABLE_PAYMENT_METHODS = ['ONLINE'];
const BLOCKING_CHECKOUT_ISSUES = new Set(['empty_cart', 'product_unavailable']);

const ORDER_STATUS_TRANSITIONS = {
  placed: ['packed', 'confirmed', 'cancelled'],
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

const CUSTOMER_CANCELABLE_STATUSES = new Set(['placed', 'confirmed', 'packed']);
const ADMIN_CANCELABLE_STATUSES = new Set(['placed', 'confirmed', 'packed']);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseNumericPrice = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);

  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getCurrentProductPrice = (product) => {
  if (
    product.discountPrice &&
    product.discountPrice > 0 &&
    product.price &&
    product.discountPrice < product.price
  ) {
    return product.discountPrice;
  }

  if (product.price !== undefined && product.price !== null) {
    return Number(product.price);
  }

  return parseNumericPrice(product.priceDisplay);
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
      'name slug sku images mainImage price priceDisplay discountPrice stock isActive'
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
    const previousUnitPrice = parseNumericPrice(item.price);
    const itemData = {
      cartItemId: item._id,
      productId: item.product._id,
      name: item.product.name,
      slug: item.product.slug,
      sku: item.product.sku,
      image: item.product.mainImage || item.product.images?.[0] || '',
      quantity: item.quantity,
      unitPrice: currentPrice,
      previousUnitPrice,
      subtotal: currentPrice * item.quantity,
      stock: item.product.stock,
      hasPriceChanged: previousUnitPrice !== undefined && previousUnitPrice !== currentPrice,
    };

    if (itemData.hasPriceChanged) {
      issues.push({
        code: 'price_changed',
        itemId: item._id,
        productId: item.product._id,
        message: `${item.product.name} price changed from ${previousUnitPrice} to ${currentPrice}`,
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
      const update = { $inc: { soldCount: item.quantity } };
      if (session) {
        await Product.updateOne({ _id: item.productId }, update, { session });
      } else {
        await Product.updateOne({ _id: item.productId }, update);
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
    await applyInventoryUpdate();
    await order.save();
    cart.items = [];
    await cart.save();
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

const buildCheckoutSnapshot = ({ summary, address, customerNotes, previewOrderNumber }) => ({
  customerUserId: summary.user._id,
  customer: {
    user: summary.user._id,
    phone: summary.user.phone,
    name: summary.user.name,
    email: summary.user.email,
  },
  items: summary.items.map((item) => ({
    cartItemId: item.cartItemId,
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    image: item.image,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
  })),
  shippingAddress: address,
  pricing: summary.pricing,
  customerNotes,
  previewOrderNumber,
});

const createCheckoutPaymentSession = async ({ summary, address, customerNotes, previewOrderNumber }) => {
  const settings = await BusinessSettings.findOne().lean();
  const checkoutSnapshot = buildCheckoutSnapshot({
    summary,
    address,
    customerNotes,
    previewOrderNumber,
  });

  const ledger = await addDebit({
    phone: summary.user.phone,
    name: summary.user.name,
    userId: summary.user._id,
    amount: summary.pricing.total,
    description: `Online checkout initiated for ${previewOrderNumber}`,
    invoiceNumber: previewOrderNumber,
    createdByRole: 'system',
  });

  const token = uuidv4();
  const previewUrl = `${FRONTEND_URL}/pay/${token}`;
  const link = new PaymentLink({
    token,
    ledger: ledger._id,
    customerPhone: summary.user.phone,
    customerName: summary.user.name,
    amount: summary.pricing.total,
    description: `Order ${previewOrderNumber}`,
    status: 'active',
    amountPaid: 0,
    invoiceImageUrl: `${FRONTEND_URL}/api/pay/${token}/preview-image.png`,
    checkoutSnapshot,
  });

  try {
    const rzpLink = await createPaymentLink({
      amount: summary.pricing.total,
      customerName: summary.user.name,
      customerPhone: summary.user.phone,
      description: `Order ${previewOrderNumber}`,
      referenceId: token,
      callbackUrl: previewUrl,
      acceptPartial: false,
    });
    link.razorpayPaymentLinkId = rzpLink.id;
    link.razorpayPaymentLinkUrl = rzpLink.short_url || previewUrl;
    link.razorpayShortUrl = rzpLink.short_url;
  } catch (_) {
    link.razorpayPaymentLinkUrl = previewUrl;
  }

  await link.save();

  return {
    link,
    previewUrl,
    paymentUrl: link.razorpayPaymentLinkUrl || previewUrl,
    orderPreviewNumber: previewOrderNumber,
  };
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

  const itemsWithProduct = order.items.filter((item) => item.product);
  await Promise.all(
    itemsWithProduct.map((item) =>
      Product.updateOne({ _id: item.product }, { $inc: { soldCount: -item.quantity } })
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

    // Hard block — check outstanding balance before allowing checkout
    const blockCheck = await checkOrderBlock(summary.user.phone);
    if (blockCheck.blocked) {
      return res.status(403).json({
        success: false,
        message: blockCheck.reason,
        data: { outstandingBalance: blockCheck.outstandingBalance, creditLimit: blockCheck.creditLimit },
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

    const paymentMethod = (req.body.paymentMethod || 'ONLINE').toString().trim().toUpperCase();

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

    const previewOrderNumber = generateOrderNumber();
    const customerNotes =
      typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : undefined;

    const paymentSession = await createCheckoutPaymentSession({
      summary,
      address,
      customerNotes,
      previewOrderNumber,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment session created successfully',
      data: {
        payment: {
          token: paymentSession.link.token,
          status: paymentSession.link.status,
          amount: paymentSession.link.amount,
          amountDue: paymentSession.link.amount,
          paymentUrl: paymentSession.paymentUrl,
          previewUrl: paymentSession.previewUrl,
          orderPreviewNumber: paymentSession.orderPreviewNumber,
        },
        selectedAddress: address,
      },
    });

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

    // ── Post-order: ledger debit + payment link + WhatsApp (non-blocking) ──
    setImmediate(async () => {
      try {
        const settings = await BusinessSettings.findOne().lean();
        const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber;
        const orderTotal = order.pricing?.total || 0;

        // 1. Add debit to customer ledger
        const ledger = await addDebit({
          phone: summary.user.phone,
          name: summary.user.name,
          userId: summary.user._id,
          amount: orderTotal,
          description: `Order #${order.orderNumber}`,
          orderId: order._id,
          invoiceNumber,
          createdByRole: 'system',
        });

        // 2. Create payment link
        const token = uuidv4();
        const callbackUrl = `${FRONTEND_URL}/pay/${token}`;
        const link = new PaymentLink({
          token,
          ledger: ledger._id,
          orderId: order._id,
          customerPhone: summary.user.phone,
          customerName: summary.user.name,
          amount: orderTotal,
          description: `Invoice #${invoiceNumber}`,
          status: 'active',
          amountPaid: 0,
        });

        try {
          const rzpLink = await createPaymentLink({
            amount: orderTotal,
            customerName: summary.user.name,
            customerPhone: summary.user.phone,
            description: `Invoice #${invoiceNumber}`,
            referenceId: token,
            callbackUrl,
          });
          link.razorpayPaymentLinkId = rzpLink.id;
          link.razorpayPaymentLinkUrl = rzpLink.short_url || callbackUrl;
          link.razorpayShortUrl = rzpLink.short_url;
        } catch (_) {
          link.razorpayPaymentLinkUrl = callbackUrl;
        }
        await link.save();

      } catch (bgErr) {
        console.error('[checkout] Background billing task failed:', bgErr.message);
      }
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
          'orderNumber customer status pricing payment invoice source createdAt confirmedAt packedAt dispatchedAt deliveredAt cancelledAt'
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

    const customerUserId = order.customer?.user;
    const [recentOrders, totalOrders] = customerUserId
      ? await Promise.all([
          Order.find({ 'customer.user': customerUserId, _id: { $ne: order._id } })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('orderNumber status pricing payment createdAt deliveredAt cancelledAt'),
          Order.countDocuments({ 'customer.user': customerUserId }),
        ])
      : [[], 0];

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

    if (nextStatus === 'paid' && !order.invoice?.sharedOnWhatsAppAt) {
      const customerPhone = order.customer?.phone ? formatPhoneNumber(order.customer.phone) : '';

      if (customerPhone && validatePhoneNumber(customerPhone)) {
        setImmediate(async () => {
          try {
            const [settings, paymentLink] = await Promise.all([
              BusinessSettings.findOne().lean(),
              PaymentLink.findOne({ orderId: order._id }).sort({ createdAt: -1 }).select('token').lean(),
            ]);

            const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber;
            const paymentPageUrl = paymentLink?.token
              ? `${FRONTEND_URL}/pay/${paymentLink.token}`
              : `${FRONTEND_URL}/orders/${order._id}`;
            const invoiceImageUrl = paymentLink?.token
              ? `${FRONTEND_URL}/api/pay/${paymentLink.token}/preview-image.png`
              : undefined;

            await sendPaymentConfirmation({
              phone: customerPhone,
              customerName: order.customer?.name,
              businessName: settings?.businessName || '',
              invoiceNumber,
              amountPaid: order.payment.paidAmount || order.pricing.total,
              paymentLink: paymentPageUrl,
              invoiceImageUrl,
              orderId: order._id,
              paymentLinkId: undefined,
            });

            await Order.updateOne(
              { _id: order._id },
              {
                'invoice.sharedOnWhatsAppAt': new Date(),
              }
            );
          } catch (whatsAppError) {
            console.error('[updateOrderPayment] WhatsApp confirmation failed:', whatsAppError.message);
          }
        });
      }
    }

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

// ─── Admin: create order ───────────────────────────────────────────────────

const adminCreateOrder = async (req, res) => {
  try {
    const {
      customer: customerBody = {},
      items: itemsBody = [],
      shippingAddress: shippingBody = {},
      payment: paymentBody = {},
      notes,
      status = 'placed',
    } = req.body;

    if (!Array.isArray(itemsBody) || itemsBody.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // Build items — support product ref OR free-text custom items
    const items = [];
    for (const raw of itemsBody) {
      if (!raw.name || !raw.price || !raw.quantity) {
        return res.status(400).json({ success: false, message: 'Each item requires name, price, and quantity' });
      }

      const item = {
        name: String(raw.name).trim(),
        price: Number(raw.price),
        quantity: Number(raw.quantity),
        unit: raw.unit || 'PCS',
        hsn: raw.hsn || '',
        cgstRate: Number(raw.cgstRate || 0),
        cgstAmount: Number(raw.cgstAmount || 0),
        sgstRate: Number(raw.sgstRate || 0),
        sgstAmount: Number(raw.sgstAmount || 0),
      };

      if (raw.sku) item.sku = String(raw.sku).toUpperCase().trim();
      if (raw.image) item.image = String(raw.image).trim();

      // Optionally link to catalogue product
      if (raw.product && mongoose.Types.ObjectId.isValid(raw.product)) {
        item.product = raw.product;
      }

      items.push(item);
    }

    // Resolve customer snapshot
    const customer = {};
    if (customerBody.userId && mongoose.Types.ObjectId.isValid(customerBody.userId)) {
      const dbUser = await User.findById(customerBody.userId).select('phone name email');
      if (dbUser) {
        customer.user = dbUser._id;
        customer.phone = formatPhoneNumber(dbUser.phone);
        customer.name = dbUser.name || '';
        customer.email = dbUser.email || '';
      }
    }

    if (!customer.phone && customerBody.phone) {
      customer.phone = formatPhoneNumber(String(customerBody.phone));
    }
    if (customerBody.name) customer.name = String(customerBody.name).trim();
    if (customerBody.email) customer.email = String(customerBody.email).trim().toLowerCase();

    if (!customer.phone) {
      return res.status(400).json({ success: false, message: 'Customer phone is required' });
    }

    // Build shipping address
    const shipping = {
      name: String(shippingBody.name || customer.name || 'Customer').trim(),
      phone: formatPhoneNumber(String(shippingBody.phone || customer.phone)),
      street: String(shippingBody.street || '').trim(),
      city: String(shippingBody.city || '').trim(),
      state: String(shippingBody.state || '').trim(),
      pincode: String(shippingBody.pincode || '').trim(),
    };
    if (shippingBody.businessName) shipping.businessName = String(shippingBody.businessName).trim();
    if (shippingBody.landmark) shipping.landmark = String(shippingBody.landmark).trim();

    if (!shipping.street || !shipping.city || !shipping.state || !shipping.pincode) {
      return res.status(400).json({ success: false, message: 'Shipping address (street, city, state, pincode) is required' });
    }

    const orderNumber = await createUniqueOrderNumber();
    const invoiceNumber = await createUniqueInvoiceNumber();

    const validStatuses = ['placed', 'confirmed', 'packed', 'dispatched', 'in_transit', 'delivered'];
    const initialStatus = validStatuses.includes(status) ? status : 'placed';

    const order = new Order({
      orderNumber,
      customer,
      items,
      shippingAddress: shipping,
      payment: {
        method: paymentBody.method || 'COD',
        status: paymentBody.status || 'pending',
        referenceId: paymentBody.referenceId,
        paidAmount: paymentBody.paidAmount || 0,
      },
      invoice: {
        isGenerated: true,
        invoiceNumber,
        generatedAt: new Date(),
        amount: 0, // will be updated after pricing is calculated by pre-validate hook
      },
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          note: 'Order created by admin',
          updatedByRole: 'admin',
        },
      ],
      paymentHistory: [
        {
          status: paymentBody.status || 'pending',
          note: 'Admin-created order',
          updatedByRole: 'admin',
        },
      ],
      source: 'admin',
      customerNotes: notes ? String(notes).trim() : undefined,
    });

    await order.save();

    // Update invoice amount with calculated total
    await Order.updateOne({ _id: order._id }, { 'invoice.amount': order.pricing.total });
    order.invoice.amount = order.pricing.total;

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order },
    });

    // ── Background: ledger debit + payment link + WhatsApp ──────────────────
    setImmediate(async () => {
      try {
        const settings = await BusinessSettings.findOne().lean();
        const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber;
        const orderTotal    = order.pricing?.total || 0;

        const ledger = await addDebit({
          phone:          order.customer.phone,
          name:           order.customer.name,
          userId:         order.customer.user || undefined,
          amount:         orderTotal,
          description:    `Order #${order.orderNumber}`,
          orderId:        order._id,
          invoiceNumber,
          createdBy:      req.user?.userId,
          createdByRole:  'admin',
        });

        const token       = uuidv4();
        const callbackUrl = `${FRONTEND_URL}/pay/${token}`;
        const link        = new PaymentLink({
          token,
          ledger:         ledger._id,
          orderId:        order._id,
          customerPhone:  order.customer.phone,
          customerName:   order.customer.name,
          amount:         orderTotal,
          description:    `Invoice #${invoiceNumber}`,
          status:         'active',
          amountPaid:     0,
          invoiceImageUrl:`${FRONTEND_URL}/api/pay/${token}/preview-image.png`,
          createdBy:      req.user?.userId,
        });

        try {
          const rzpLink = await createPaymentLink({
            amount:       orderTotal,
            customerName: order.customer.name,
            customerPhone:order.customer.phone,
            description:  `Invoice #${invoiceNumber}`,
            referenceId:  token,
            callbackUrl,
          });
          link.razorpayPaymentLinkId  = rzpLink.id;
          link.razorpayPaymentLinkUrl = rzpLink.short_url || callbackUrl;
          link.razorpayShortUrl       = rzpLink.short_url;
        } catch (_) {
          link.razorpayPaymentLinkUrl = callbackUrl;
        }
        await link.save();

      } catch (bgErr) {
        console.error('[adminCreateOrder] Background billing task failed:', bgErr.message);
      }
    });
  } catch (err) {
    console.error('Admin Create Order Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── Admin: download invoice PDF ───────────────────────────────────────────

const getOrderInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let settings = await BusinessSettings.findOne({ _singleton: 'settings' });
    if (!settings) {
      const { getSettings: _gs } = require('./admin.settings.controller');
      settings = await BusinessSettings.create({ _singleton: 'settings' });
    }

    const pdfBuffer = await generateInvoicePdf(order.toObject(), settings.toObject());

    const invoiceNo = order.invoice?.invoiceNumber || order.orderNumber;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoiceNo}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Invoice PDF Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF', error: err.message });
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
  adminCreateOrder,
  getOrderInvoicePdf,
};
