const Razorpay = require('razorpay');
const crypto = require('crypto');

let instance = null;

const getInstance = () => {
  if (!instance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
};

/**
 * Create a Razorpay Payment Link for an invoice.
 * Supports partial payments by default.
 *
 * @param {Object} params
 * @param {number}  params.amount          - Amount in INR (NOT paise)
 * @param {string}  params.customerName
 * @param {string}  params.customerPhone
 * @param {string}  params.description
 * @param {string}  params.referenceId     - Our internal token / invoice number
 * @param {string}  params.callbackUrl     - URL to redirect after payment (payment page)
 * @param {boolean} [params.acceptPartial] - Allow partial payments (default: true)
 * @returns Razorpay payment link object
 */
const createPaymentLink = async ({
  amount,
  customerName,
  customerPhone,
  description,
  referenceId,
  callbackUrl,
  acceptPartial = true,
}) => {
  const rzp = getInstance();

  // Razorpay requires amount in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(amount * 100);

  // Phone must be 10 digits for Razorpay (strip country code)
  const phone = customerPhone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10);

  const payload = {
    amount: amountInPaise,
    currency: 'INR',
    accept_partial: acceptPartial,
    description: description || 'Invoice Payment',
    customer: {
      name: customerName || 'Customer',
      contact: phone,
    },
    notify: {
      sms: false,    // we handle WhatsApp ourselves
      email: false,
    },
    reminder_enable: false, // we handle reminders ourselves
    reference_id: referenceId,
    callback_url: callbackUrl,
    callback_method: 'get',
  };

  if (acceptPartial && amount > 0) {
    // Minimum partial amount = 1 INR or 10% of total, whichever is lower
    payload.first_min_partial_amt = Math.max(100, Math.round(amountInPaise * 0.1));
  }

  const link = await rzp.paymentLink.create(payload);
  return link;
};

/**
 * Fetch a Razorpay payment link by its ID.
 */
const getPaymentLink = async (razorpayPaymentLinkId) => {
  const rzp = getInstance();
  return rzp.paymentLink.fetch(razorpayPaymentLinkId);
};

/**
 * Verify Razorpay webhook signature.
 * Returns true if valid.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET not set');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
};

/**
 * Verify payment signature for checkout (not payment links).
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
};

module.exports = {
  createPaymentLink,
  getPaymentLink,
  verifyWebhookSignature,
  verifyPaymentSignature,
};
