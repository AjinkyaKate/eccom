const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    paymentLinkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentLink',
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'system', 'customer'],
      default: 'system',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const customerLedgerSchema = new mongoose.Schema(
  {
    // customer ref — null for manually imported customers not yet registered
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    // always required — primary key for lookup
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    // 0 = no limit
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    // hard block — set automatically when outstandingBalance > creditLimit (and limit > 0)
    isOrderBlocked: {
      type: Boolean,
      default: false,
    },
    // cached — recomputed on every transaction
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    totalDebits: {
      type: Number,
      default: 0,
    },
    totalCredits: {
      type: Number,
      default: 0,
    },
    entries: {
      type: [ledgerEntrySchema],
      default: [],
    },
    lastPaymentAt: Date,
    lastOrderAt: Date,
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

customerLedgerSchema.index({ phone: 1 });
customerLedgerSchema.index({ customer: 1 }, { sparse: true });
customerLedgerSchema.index({ isOrderBlocked: 1 });
customerLedgerSchema.index({ outstandingBalance: -1 });

// Recompute cached balance fields from entries array
customerLedgerSchema.methods.recomputeBalance = function () {
  let debits = 0;
  let credits = 0;
  for (const entry of this.entries) {
    if (entry.type === 'debit') debits += entry.amount;
    else credits += entry.amount;
  }
  this.totalDebits = debits;
  this.totalCredits = credits;
  this.outstandingBalance = Math.max(0, debits - credits);

  // Auto-set block flag when credit limit is set and breached
  if (this.creditLimit > 0 && this.outstandingBalance > this.creditLimit) {
    this.isOrderBlocked = true;
  }
};

module.exports = mongoose.model('CustomerLedger', customerLedgerSchema);
