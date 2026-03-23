const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    sourceAddressId: mongoose.Schema.Types.ObjectId,
    type: {
      type: String,
      trim: true,
      default: 'other',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
    },
    formattedAddress: {
      type: String,
      trim: true,
    },
    placeId: {
      type: String,
      trim: true,
    },
    latitude: Number,
    longitude: Number,
    deliveryInstructions: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    _id: false,
  }
);

const customerSnapshotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    _id: false,
  }
);

const pricingSchema = new mongoose.Schema(
  {
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shippingCharges: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['COD', 'ONLINE', 'BANK_TRANSFER'],
      required: true,
      default: 'COD',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      required: true,
      default: 'pending',
    },
    referenceId: {
      type: String,
      trim: true,
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paidAt: Date,
    lastUpdatedAt: Date,
  },
  {
    _id: false,
  }
);

const invoiceSchema = new mongoose.Schema(
  {
    isGenerated: {
      type: Boolean,
      default: false,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    generatedAt: Date,
    amount: {
      type: Number,
      min: 0,
    },
    sharedOnWhatsAppAt: Date,
  },
  {
    _id: false,
  }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedByRole: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      default: 'system',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const paymentHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    referenceId: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedByRole: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      default: 'system',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customer: {
      type: customerSnapshotSchema,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    pricing: {
      type: pricingSchema,
      required: true,
      default: () => ({}),
    },
    payment: {
      type: paymentSchema,
      required: true,
      default: () => ({}),
    },
    invoice: {
      type: invoiceSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'dispatched', 'in_transit', 'delivered', 'cancelled'],
      default: 'placed',
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    paymentHistory: {
      type: [paymentHistorySchema],
      default: [],
    },
    source: {
      type: String,
      enum: ['website', 'whatsapp'],
      default: 'website',
    },
    customerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    stockRestoredAt: Date,
    confirmedAt: Date,
    packedAt: Date,
    dispatchedAt: Date,
    inTransitAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1, createdAt: -1 });
orderSchema.index({ 'customer.phone': 1, createdAt: -1 });
orderSchema.index({ 'customer.email': 1, createdAt: -1 });
orderSchema.pre('validate', function () {
  this.items = Array.isArray(this.items)
    ? this.items.map((item) => {
        const rawItem = typeof item.toObject === 'function' ? item.toObject() : item;

        return {
          ...rawItem,
          subtotal: Number(rawItem.price || 0) * Number(rawItem.quantity || 0),
        };
      })
    : [];

  const subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingCharges = Number(this.pricing?.shippingCharges || 0);
  const discount = Number(this.pricing?.discount || 0);
  const total = Math.max(0, subtotal + shippingCharges - discount);

  this.pricing = {
    subtotal,
    shippingCharges,
    discount,
    total,
  };

  this.payment = {
    method: this.payment?.method || 'COD',
    status: this.payment?.status || 'pending',
    referenceId: this.payment?.referenceId,
    paidAmount:
      this.payment?.status === 'paid'
        ? Number(this.payment?.paidAmount || total)
        : Number(this.payment?.paidAmount || 0),
    paidAt: this.payment?.paidAt,
    lastUpdatedAt: this.payment?.lastUpdatedAt,
  };

  if (this.payment.status === 'paid' && !this.payment.paidAt) {
    this.payment.paidAt = new Date();
  }

  if (!this.payment.lastUpdatedAt) {
    this.payment.lastUpdatedAt = new Date();
  }
});

orderSchema.virtual('totalItems').get(function () {
  if (!Array.isArray(this.items)) {
    return 0;
  }

  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
