const PaymentLink = require('../models/PaymentLink');
const Order = require('../models/Order');
const BusinessSettings = require('../models/BusinessSettings');
const { addCredit } = require('../services/ledger.service');
const { verifyWebhookSignature } = require('../services/razorpay.service');
const { sendPaymentConfirmation } = require('../services/billing.whatsapp.service');
const { generateInvoicePdf } = require('../services/invoice.service');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * GET /api/pay/:token
 * Public — no auth required.
 * Returns payment link data for the customer-facing payment page.
 */
const getPaymentPage = async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ token: req.params.token })
      .populate('orderId', 'orderNumber items pricing payment invoice customer shippingAddress')
      .lean({ virtuals: true });

    if (!link) {
      return res.status(404).json({ success: false, message: 'Payment link not found or expired' });
    }

    if (link.status === 'expired' || link.status === 'cancelled') {
      return res.status(410).json({ success: false, message: 'This payment link is no longer active' });
    }

    const settings = await BusinessSettings.findOne().lean();

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
        order: link.orderId || null,
        payments: link.payments,
        razorpayPaymentLinkUrl: link.razorpayPaymentLinkUrl,
        razorpayShortUrl: link.razorpayShortUrl,
        businessName: settings?.businessName || '',
        businessPhone: settings?.phone || '',
        upiId: settings?.upiId || '',
        createdAt: link.createdAt,
      },
    });
  } catch (err) {
    console.error('getPaymentPage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/pay/:token/invoice.pdf
 * Public — download the invoice PDF for this payment link.
 */
const downloadInvoice = async (req, res) => {
  try {
    const link = await PaymentLink.findOne({ token: req.params.token })
      .populate('orderId')
      .lean();

    if (!link?.orderId) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const settings = await BusinessSettings.findOne().lean();
    const pdfBuffer = await generateInvoicePdf(link.orderId, settings || {});

    const filename = `invoice-${link.orderId.invoice?.invoiceNumber || link.orderId.orderNumber}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('downloadInvoice error:', err);
    res.status(500).json({ success: false, message: 'Could not generate invoice' });
  }
};

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook — raw body required.
 * Handles: payment_link.paid, payment.captured
 */
const handleRazorpayWebhook = async (req, res) => {
  // Always respond 200 quickly to Razorpay
  res.status(200).json({ received: true });

  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[webhook] Invalid Razorpay signature');
      return;
    }

    const event = req.body;
    const eventType = event.event;

    // We handle payment_link.paid and payment.captured
    // payment.captured fires for EVERY payment (including partials)
    if (eventType !== 'payment.captured' && eventType !== 'payment_link.paid') {
      return;
    }

    // For payment_link.paid, the entity is the payment link
    // For payment.captured, we look at payment entity
    let razorpayPaymentLinkId;
    let paymentAmount;
    let paymentId;
    let paymentMethod;

    if (eventType === 'payment_link.paid') {
      razorpayPaymentLinkId = event.payload?.payment_link?.entity?.id;
      paymentAmount = event.payload?.payment?.entity?.amount / 100; // paise to INR
      paymentId = event.payload?.payment?.entity?.id;
      paymentMethod = event.payload?.payment?.entity?.method;
    } else if (eventType === 'payment.captured') {
      // payment.captured doesn't directly give us payment_link_id
      // Use payment_link_id from payment entity if available
      razorpayPaymentLinkId = event.payload?.payment?.entity?.payment_link_id;
      paymentAmount = event.payload?.payment?.entity?.amount / 100;
      paymentId = event.payload?.payment?.entity?.id;
      paymentMethod = event.payload?.payment?.entity?.method;
    }

    if (!razorpayPaymentLinkId && !paymentId) {
      console.warn('[webhook] Could not extract payment info from event');
      return;
    }

    // Find our internal PaymentLink
    const link = await PaymentLink.findOne({ razorpayPaymentLinkId });
    if (!link) {
      // Could be a non-billing payment (future checkout payments)
      console.log('[webhook] No internal PaymentLink found for', razorpayPaymentLinkId);
      return;
    }

    // Idempotency check — skip if we already recorded this payment
    const alreadyRecorded = link.payments.some((p) => p.razorpayPaymentId === paymentId);
    if (alreadyRecorded) {
      console.log('[webhook] Payment already recorded:', paymentId);
      return;
    }

    // Record this payment on the link
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

    await link.save();

    // Add credit to customer ledger
    const settings = await BusinessSettings.findOne().lean();
    const ledger = await addCredit({
      phone: link.customerPhone,
      amount: paymentAmount,
      description: `Payment received via Razorpay`,
      orderId: link.orderId || undefined,
      invoiceNumber: link.description,
      paymentLinkId: link._id,
      paymentMethod: paymentMethod,
      referenceId: paymentId,
      createdByRole: 'system',
    });

    // Update order payment status if fully paid
    if (link.orderId && amountDue <= 0) {
      await Order.findByIdAndUpdate(link.orderId, {
        'payment.status': 'paid',
        'payment.paidAmount': link.amountPaid,
        'payment.referenceId': paymentId,
        'payment.paidAt': new Date(),
        $push: {
          paymentHistory: {
            status: 'paid',
            note: `Paid via Razorpay (${paymentMethod})`,
            amount: link.amountPaid,
            referenceId: paymentId,
            updatedByRole: 'system',
          },
        },
      });
    }

    // Send WhatsApp confirmation
    const paymentPageUrl = `${FRONTEND_URL}/pay/${link.token}`;
    const order = link.orderId ? await Order.findById(link.orderId).select('invoice orderNumber').lean() : null;
    const invoiceNumber = order?.invoice?.invoiceNumber || order?.orderNumber || link.description;

    await sendPaymentConfirmation({
      phone: link.customerPhone,
      customerName: link.customerName,
      businessName: settings?.businessName || '',
      invoiceNumber,
      amountPaid: paymentAmount,
      amountDue,
      paymentLink: paymentPageUrl,
      ledgerId: ledger?._id,
      orderId: link.orderId || undefined,
      paymentLinkId: link._id,
    });

    console.log(`[webhook] Payment ₹${paymentAmount} recorded for ${link.customerPhone}`);
  } catch (err) {
    console.error('[webhook] Error processing Razorpay webhook:', err);
  }
};

module.exports = {
  getPaymentPage,
  downloadInvoice,
  handleRazorpayWebhook,
};
