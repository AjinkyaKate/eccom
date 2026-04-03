const mongoose = require('mongoose');

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    // machine-readable key used in code — never change after creation
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Template body with {{variableName}} placeholders
    // Available variables: customerName, businessName, invoiceNumber,
    //   amount, amountDue, amountPaid, paymentLink, orderNumber
    body: {
      type: String,
      required: true,
    },
    // list of variable names used in the body (for UI display)
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // when this template is triggered automatically
    triggerOn: {
      type: String,
      enum: ['order_placed', 'payment_confirmed', 'manual', 'scheduled'],
      default: 'manual',
    },
    // for scheduled reminders: send X days after order with no payment
    scheduleAfterDays: {
      type: Number,
      min: 0,
    },
    isSystemTemplate: {
      type: Boolean,
      default: false, // system templates cannot be deleted
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema);
