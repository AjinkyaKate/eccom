const BusinessSettings = require('../models/BusinessSettings');

const DEFAULT_SETTINGS = {
  businessName: 'MANGALRAJ ENTERPRISES',
  tagline: '',
  address: 'FLAT NO D-301, RAGA ALTIS, PHASE II, GOLDEN CITY, PAITHAN ROAD',
  city: 'CHHATRAPATI SAMBHAJINAGAR',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '431001',
  phone: '8857000111',
  email: '',
  gstin: '',
  pan: '',
  bankName: 'DEOGIRI BANK',
  bankBranch: 'CIDCO BRANCH',
  bankAccountName: 'MANGALRAJ ENTERPRISES',
  bankAccountNumber: '080311001004001',
  bankIfsc: 'DEOB0000004',
  upiId: 'rushirajpatil111@axl',
  upiPhone: '8857000111',
  logoUrl: '',
  termsAndConditions: [
    'Goods once sold will not be taken back or exchanged.',
    'All disputes subject to local jurisdiction only.',
    'Payment to be made within 30 days of invoice date.',
  ],
  invoicePrefix: 'INV',
  defaultCgstRate: 0,
  defaultSgstRate: 0,
};

const getSettings = async (req, res) => {
  try {
    let settings = await BusinessSettings.findOne({ _singleton: 'settings' });
    if (!settings) {
      settings = await BusinessSettings.create({ _singleton: 'settings', ...DEFAULT_SETTINGS });
    }
    res.json({ success: true, data: { settings } });
  } catch (err) {
    console.error('Get Settings Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const allowed = [
      'businessName', 'tagline', 'address', 'city', 'state', 'stateCode', 'pincode',
      'phone', 'email', 'gstin', 'pan',
      'bankName', 'bankBranch', 'bankAccountName', 'bankAccountNumber', 'bankIfsc',
      'upiId', 'upiPhone', 'logoUrl', 'termsAndConditions',
      'invoicePrefix', 'defaultCgstRate', 'defaultSgstRate',
    ];

    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const settings = await BusinessSettings.findOneAndUpdate(
      { _singleton: 'settings' },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Settings saved', data: { settings } });
  } catch (err) {
    console.error('Update Settings Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateSettings };
