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
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
      default: null,
    },
    images: {
      type: [String],
      default: [],
    },
    mainImage: {
      type: String,
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be negative'],
        max: [5, 'Rating cannot exceed 5'],
      },
      count: {
        type: Number,
        default: 0,
        min: [0, 'Rating count cannot be negative'],
      },
    },
    soldCount: {
      type: Number,
      default: 0,
      min: [0, 'Sold count cannot be negative'],
    },
    tags: {
      type: [String],
      default: [],
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

productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({
  name: 'text',
  shortDescription: 'text',
  description: 'text',
  tags: 'text',
});

productSchema.pre('validate', function () {
  if (this.name) {
    this.slug = slugify(this.name);
  }

  if (this.sku) {
    this.sku = this.sku.trim().toUpperCase();
  }

  this.images = Array.isArray(this.images)
    ? this.images.map((image) => image.trim()).filter(Boolean)
    : [];

  this.tags = Array.isArray(this.tags)
    ? this.tags
        .map((tag) => tag.toString().trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (!this.mainImage && this.images.length > 0) {
    this.mainImage = this.images[0];
  }

  if (
    this.discountPrice !== null &&
    this.discountPrice !== undefined &&
    this.discountPrice >= this.price
  ) {
    this.invalidate('discountPrice', 'Discount price must be less than regular price');
  }
});

productSchema.virtual('finalPrice').get(function () {
  return this.discountPrice && this.discountPrice > 0 ? this.discountPrice : this.price;
});

productSchema.virtual('discountPercentage').get(function () {
  if (!this.discountPrice || this.discountPrice <= 0 || this.discountPrice >= this.price) {
    return 0;
  }

  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
