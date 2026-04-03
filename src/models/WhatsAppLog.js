const mongoose = require('mongoose');

const whatsAppLogSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    // optional refs
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerLedger' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    paymentLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentLink' },
    messageType: {
      type: String,
      enum: [
        'invoice_sent',
        'payment_reminder',
        'payment_confirmed',
        'order_placed',
        'order_status_update',
        'custom',
      ],
      required: true,
    },
    templateKey: {
      type: String,
      trim: true,
    },
    renderedBody: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'queued',
    },
    // ID returned by Green API
    greenApiMessageId: {
      type: String,
      trim: true,
    },
    failedReason: {
      type: String,
      trim: true,
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    retryCount: { type: Number, default: 0 },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sentByRole: {
      type: String,
      enum: ['admin', 'system'],
      default: 'system',
    },
  },
  { timestamps: true }
);

whatsAppLogSchema.index({ phone: 1, createdAt: -1 });
whatsAppLogSchema.index({ orderId: 1 }, { sparse: true });
whatsAppLogSchema.index({ paymentLinkId: 1 }, { sparse: true });
whatsAppLogSchema.index({ status: 1 });
whatsAppLogSchema.index({ messageType: 1 });

module.exports = mongoose.model('WhatsAppLog', whatsAppLogSchema);
