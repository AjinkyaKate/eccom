const mongoose = require('mongoose');

const slugify = (value = '') => {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    priceDisplay: {
      type: String,
      required: [true, 'Price display is required (e.g., Rs 160 per kg)'],
      trim: true,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    soldCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    mainImage: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Short description cannot exceed 500 characters'],
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    tags: {
      type: [String],
      default: [],
    },
    unit: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'PCS',
    },
    hsn: {
      type: String,
      trim: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
      },
      count: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text' });

const parseNumericPrice = (value = '') => {
  const normalized = value.toString().replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);

  if (!match) {
    return 0;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

productSchema.pre('validate', function () {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }

  if ((!this.mainImage || !this.mainImage.trim()) && Array.isArray(this.images) && this.images[0]) {
    this.mainImage = this.images[0];
  }

  if ((!this.price || this.price <= 0) && this.priceDisplay) {
    this.price = parseNumericPrice(this.priceDisplay);
  }

  if (this.discountPrice !== undefined && this.discountPrice !== null && this.price > 0) {
    if (this.discountPrice > this.price) {
      this.discountPrice = this.price;
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
