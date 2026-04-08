const PaymentLink = require('../models/PaymentLink');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const BusinessSettings = require('../models/BusinessSettings');
const { verifyWebhookSignature } = require('../services/razorpay.service');
const { sendPaymentConfirmation } = require('../services/billing.whatsapp.service');
const { generateInvoicePdf } = require('../services/invoice.service');
const { generateOrderNumber, generateInvoiceNumber } = require('../utils/orderNumber.util');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const hasConfiguredRazorpay =
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) &&
  process.env.RAZORPAY_KEY_ID !== 'rzp_test_REPLACE_ME' &&
  process.env.RAZORPAY_KEY_SECRET !== 'REPLACE_ME';

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

const resolveFinalOrderNumber = async (preferredOrderNumber) => {
  if (preferredOrderNumber) {
    const existingOrder = await Order.exists({ orderNumber: preferredOrderNumber });
    if (!existingOrder) {
      return preferredOrderNumber;
    }
  }

  return createUniqueOrderNumber();
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

const buildPreviewOrder = (link) => {
  const snapshot = link.checkoutSnapshot || {};

  return {
    orderNumber: snapshot.previewOrderNumber || `PAY-${String(link.token || '').slice(0, 8).toUpperCase()}`,
    createdAt: link.createdAt,
    customer: snapshot.customer || {
      name: link.customerName,
      phone: link.customerPhone,
    },
    shippingAddress: snapshot.shippingAddress || null,
    pricing: snapshot.pricing || {
      subtotal: link.amount,
      shippingCharges: 0,
      discount: 0,
      total: link.amount,
    },
    items: snapshot.items || [],
    payment: {
      method: 'ONLINE',
      status: link.status === 'paid' ? 'paid' : 'pending',
      paidAmount: link.amountPaid || 0,
    },
    invoice: null,
  };
};

const clearPurchasedCartItems = async (userId, cartItemIds = []) => {
  if (!userId || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
    return;
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return;
  }

  const idSet = new Set(cartItemIds.map((id) => String(id)));
  cart.items = cart.items.filter((item) => !idSet.has(String(item._id)));
  await cart.save();
};

const createOrderFromCheckoutSnapshot = async (link, paymentAmount, paymentId, paymentMethod) => {
  if (link.orderId) {
    return Order.findById(link.orderId);
  }

  const snapshot = link.checkoutSnapshot || {};
  const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];

  if (!snapshot.customerUserId || !snapshot.shippingAddress || snapshotItems.length === 0) {
    throw new Error('Payment link is missing checkout snapshot data');
  }

  const order = new Order({
    orderNumber: await resolveFinalOrderNumber(snapshot.previewOrderNumber),
    customer: snapshot.customer,
    items: snapshotItems.map((item) => ({
      product: item.productId,
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      price: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      image: item.image,
      unit: item.unit || 'PCS',
      hsn: item.hsn || '',
      cgstRate: Number(item.cgstRate || 0),
      cgstAmount: Number(item.cgstAmount || 0),
      sgstRate: Number(item.sgstRate || 0),
      sgstAmount: Number(item.sgstAmount || 0),
    })),
    shippingAddress: snapshot.shippingAddress,
    pricing: snapshot.pricing,
    payment: {
      method: 'ONLINE',
      status: 'paid',
      referenceId: paymentId,
      paidAmount: paymentAmount,
      paidAt: new Date(),
      lastUpdatedAt: new Date(),
    },
    paymentHistory: [
      {
        status: 'paid',
        note: `Paid via Razorpay (${paymentMethod || 'online'})`,
        referenceId: paymentId,
        amount: paymentAmount,
        updatedByRole: 'system',
      },
    ],
    invoice: {
      isGenerated: true,
      invoiceNumber: await createUniqueInvoiceNumber(),
      generatedAt: new Date(),
      amount: snapshot.pricing?.total || paymentAmount,
      sharedOnWhatsAppAt: null,
    },
    status: 'placed',
    statusHistory: [
      {
        status: 'placed',
        note: 'Paid order created automatically after online payment',
        updatedByRole: 'system',
      },
    ],
    source: 'website',
    customerNotes: snapshot.customerNotes,
  });

  await order.save();

  await Promise.all(
    snapshotItems
      .filter((item) => item.productId)
      .map((item) =>
        Product.updateOne({ _id: item.productId }, { $inc: { soldCount: item.quantity } })
      )
  );

  await clearPurchasedCartItems(snapshot.customerUserId, snapshotItems.map((item) => item.cartItemId).filter(Boolean));

  link.orderId = order._id;
  await link.save();

  return order;
};

const finalizePaymentLink = async (link, paymentAmount, paymentId, paymentMethod) => {
  const alreadyRecorded = link.payments.some((payment) => payment.razorpayPaymentId === paymentId);
  if (alreadyRecorded) {
    return { link, order: link.orderId ? await Order.findById(link.orderId) : null, alreadyRecorded: true };
  }

  link.payments.push({
    razorpayPaymentId: paymentId,
    amount: paymentAmount,
    method: paymentMethod,
    status: 'captured',
    paidAt: new Date(),
  });

  link.amountPaid = (link.amountPaid || 0) + paymentAmount;
  link.lastWebhookAt = new Date();

  const amountDue = Math.max(0, link.amount - link.amountPaid);
  link.status = amountDue <= 0 ? 'paid' : 'partially_paid';

  let order = null;
  if (amountDue <= 0) {
    order = await createOrderFromCheckoutSnapshot(link, link.amountPaid, paymentId, paymentMethod);
  }

  await link.save();

  if (order) {
    const settings = await BusinessSettings.findOne().lean();
    const paymentPageUrl = `${FRONTEND_URL}/pay/${link.token}`;
    const invoiceImageUrl = `${FRONTEND_URL}/api/pay/${link.token}/preview-image.png`;
    const invoiceNumber = order.invoice?.invoiceNumber || order.orderNumber;

    if (link.invoiceImageUrl !== invoiceImageUrl) {
      link.invoiceImageUrl = invoiceImageUrl;
      await link.save();
    }

    await sendPaymentConfirmation({
      phone: link.customerPhone,
      customerName: link.customerName,
      businessName: settings?.businessName || '',
      invoiceNumber,
      amountPaid: link.amountPaid,
      paymentLink: paymentPageUrl,
      invoiceImageUrl,
      orderId: order._id,
      paymentLinkId: link._id,
    });

    await Order.updateOne(
      { _id: order._id },
      {
        'invoice.sharedOnWhatsAppAt': new Date(),
      }
    );
  }

  return { link, order, alreadyRecorded: false };
};

const getPaymentPage = async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ token: req.params.token })
      .populate('orderId', 'orderNumber items pricing payment invoice customer shippingAddress createdAt status')
      .lean({ virtuals: true });

    if (!link) {
      return res.status(404).json({ success: false, message: 'Payment link not found or expired' });
    }

    if (link.status === 'expired' || link.status === 'cancelled') {
      return res.status(410).json({ success: false, message: 'This payment link is no longer active' });
    }

    const settings = await BusinessSettings.findOne().lean();
    const previewOrder = link.orderId || buildPreviewOrder(link);

    res.status(200).json({
      success: true,
      data: {
        token: link.token,
        status: link.status,
        amount: link.amount,
        amountPaid: link.amountPaid,
        amountDue: Math.max(0, link.amount - link.amountPaid),
        description: link.description,
        customerName: link.customerName,
        customerBusinessName: link.customerBusinessName,
        order: previewOrder,
        isOrderCreated: Boolean(link.orderId),
        payments: link.payments,
        razorpayPaymentLinkUrl: link.razorpayPaymentLinkUrl,
        razorpayShortUrl: link.razorpayShortUrl,
        canSimulatePayment: process.env.NODE_ENV !== 'production',
        hasConfiguredRazorpay,
        businessName: settings?.businessName || '',
        businessPhone: settings?.phone || '',
        businessAddress: settings?.address || '',
        gstin: settings?.gstin || '',
        upiId: settings?.upiId || '',
        bankAccountNumber: settings?.bankAccountNumber || '',
        bankIfsc: settings?.bankIfsc || '',
        createdAt: link.createdAt,
        previewUrl: `${FRONTEND_URL}/pay/${link.token}`,
        canonicalBillUrl: `${FRONTEND_URL}/pay/${link.token}`,
        invoiceImageUrl: link.invoiceImageUrl || `${FRONTEND_URL}/api/pay/${link.token}/preview-image.png`,
      },
    });
  } catch (err) {
    console.error('getPaymentPage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const simulatePaymentSuccess = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Test payment is disabled in production' });
  }

  try {
    const link = await PaymentLink.findOne({ token: req.params.token });
    if (!link) {
      return res.status(404).json({ success: false, message: 'Payment link not found or expired' });
    }

    if (link.status === 'expired' || link.status === 'cancelled') {
      return res.status(410).json({ success: false, message: 'This payment link is no longer active' });
    }

    const paymentId = `testpay_${Date.now()}`;
    const { order, alreadyRecorded } = await finalizePaymentLink(link, Math.max(0, link.amountDue || link.amount), paymentId, 'test');

    return res.status(200).json({
      success: true,
      message: alreadyRecorded ? 'Payment was already recorded' : 'Test payment recorded successfully',
      data: {
        token: link.token,
        status: link.status,
        orderId: order?._id || link.orderId || null,
        previewUrl: `${FRONTEND_URL}/pay/${link.token}`,
      },
    });
  } catch (err) {
    console.error('simulatePaymentSuccess error:', err);
    return res.status(500).json({ success: false, message: 'Could not record test payment' });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ token: req.params.token })
      .populate('orderId')
      .lean();

    if (!link?.orderId) {
      return res.status(404).json({ success: false, message: 'Invoice is available after payment confirmation' });
    }

    const settings = await BusinessSettings.findOne().lean();
    const pdfBuffer = await generateInvoicePdf(link.orderId, settings || {});

    const filename = `invoice-${link.orderId.invoice?.invoiceNumber || link.orderId.orderNumber}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('downloadInvoice error:', err);
    res.status(500).json({ success: false, message: 'Could not generate invoice' });
  }
};

const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[webhook] Invalid Razorpay signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;
    const eventType = event.event;

    if (eventType !== 'payment.captured' && eventType !== 'payment_link.paid') {
      return res.status(200).json({ received: true, ignored: true });
    }

    let razorpayPaymentLinkId;
    let paymentAmount;
    let paymentId;
    let paymentMethod;

    if (eventType === 'payment_link.paid') {
      razorpayPaymentLinkId = event.payload?.payment_link?.entity?.id;
      paymentAmount = event.payload?.payment?.entity?.amount / 100;
      paymentId = event.payload?.payment?.entity?.id;
      paymentMethod = event.payload?.payment?.entity?.method;
    } else {
      razorpayPaymentLinkId = event.payload?.payment?.entity?.payment_link_id;
      paymentAmount = event.payload?.payment?.entity?.amount / 100;
      paymentId = event.payload?.payment?.entity?.id;
      paymentMethod = event.payload?.payment?.entity?.method;
    }

    if (!razorpayPaymentLinkId && !paymentId) {
      console.warn('[webhook] Could not extract payment info from event');
      return res.status(400).json({ success: false, message: 'Missing payment payload' });
    }

    const link = await PaymentLink.findOne({ razorpayPaymentLinkId });
    if (!link) {
      console.log('[webhook] No internal PaymentLink found for', razorpayPaymentLinkId);
      return res.status(404).json({ success: false, message: 'Payment link not found' });
    }

    const { alreadyRecorded } = await finalizePaymentLink(link, paymentAmount, paymentId, paymentMethod);
    if (alreadyRecorded) {
      console.log('[webhook] Payment already recorded:', paymentId);
      return res.status(200).json({ received: true, duplicate: true });
    }

    console.log(`[webhook] Payment recorded for ${link.customerPhone}`);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Error processing Razorpay webhook:', err);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

module.exports = {
  getPaymentPage,
  downloadInvoice,
  simulatePaymentSuccess,
  handleRazorpayWebhook,
};
