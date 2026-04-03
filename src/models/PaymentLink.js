const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema(
  {
    razorpayPaymentId: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true },
    status: { type: String, trim: true },
    paidAt: { type: Date, default: Date.now },
    referenceId: { type: String, trim: true },
  },
  { _id: true }
);

const paymentLinkSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },
    ledger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerLedger',
      required: true,
    },
    // optional — tied to a specific order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    // optional — tied to a specific ledger entry (for manual balance imports)
    ledgerEntryId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    // customer snapshot (denormalized for fast display on payment page)
    customerPhone: { type: String, required: true, trim: true },
    customerName: { type: String, trim: true },
    customerBusinessName: { type: String, trim: true },
    // original invoice amount when link was created
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'partially_paid', 'paid', 'expired', 'cancelled'],
      default: 'active',
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    payments: {
      type: [paymentRecordSchema],
      default: [],
    },
    // Razorpay fields
    razorpayPaymentLinkId: { type: String, trim: true },
    razorpayPaymentLinkUrl: { type: String, trim: true },
    razorpayShortUrl: { type: String, trim: true },
    // expiry
    expiresAt: { type: Date },
    // WhatsApp send tracking
    whatsappSentAt: { type: Date },
    lastReminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    // who created this link
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastWebhookAt: { type: Date },
  },
  { timestamps: true }
);

paymentLinkSchema.index({ token: 1 });
paymentLinkSchema.index({ ledger: 1 });
paymentLinkSchema.index({ orderId: 1 }, { sparse: true });
paymentLinkSchema.index({ status: 1 });
paymentLinkSchema.index({ razorpayPaymentLinkId: 1 }, { sparse: true });

paymentLinkSchema.virtual('amountDue').get(function () {
  return Math.max(0, this.amount - this.amountPaid);
});

paymentLinkSchema.set('toJSON', { virtuals: true });
paymentLinkSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PaymentLink', paymentLinkSchema);
