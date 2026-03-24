const mongoose = require('mongoose');

const businessSettingsSchema = new mongoose.Schema(
  {
    _singleton: {
      type: String,
      default: 'settings',
      unique: true,
    },
    businessName: { type: String, trim: true, default: '' },
    tagline: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    pan: { type: String, trim: true, uppercase: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    bankBranch: { type: String, trim: true, default: '' },
    bankAccountName: { type: String, trim: true, default: '' },
    bankAccountNumber: { type: String, trim: true, default: '' },
    bankIfsc: { type: String, trim: true, uppercase: true, default: '' },
    upiId: { type: String, trim: true, default: '' },
    upiPhone: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    termsAndConditions: [{ type: String, trim: true }],
    invoicePrefix: { type: String, trim: true, default: 'INV' },
    defaultCgstRate: { type: Number, default: 0 },
    defaultSgstRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessSettings', businessSettingsSchema);
