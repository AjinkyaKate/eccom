const mongoose = require('mongoose');
const User = require('../models/User');
const { validatePhoneNumber, formatPhoneNumber } = require('../utils/otp.util');

const MAX_ADDRESSES = 10;

const formatAddress = (addr) => ({
  id: addr._id,
  type: addr.type,
  name: addr.name,
  phone: addr.phone,
  street: addr.street,
  city: addr.city,
  state: addr.state,
  pincode: addr.pincode,
  landmark: addr.landmark,
  isDefault: addr.isDefault,
});

const validateAddressFields = (body) => {
  const required = ['name', 'phone', 'street', 'city', 'state', 'pincode'];
  const missing = required.find((f) => !body[f] || body[f].toString().trim() === '');
  if (missing) return `${missing} is required`;
  if (!validatePhoneNumber(body.phone)) return 'Invalid phone number format';
  return null;
};

// GET /api/addresses
const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    res.json({ success: true, data: user.addresses.map(formatAddress) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/addresses
const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');

    if (user.addresses.length >= MAX_ADDRESSES) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_ADDRESSES} addresses allowed`,
      });
    }

    const error = validateAddressFields(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { type, name, phone, street, city, state, pincode, landmark, isDefault } = req.body;

    // First address is always default; otherwise respect the isDefault flag
    const makeDefault = user.addresses.length === 0 || isDefault === true;

    if (makeDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    user.addresses.push({
      type: type || 'home',
      name: name.toString().trim(),
      phone: formatPhoneNumber(phone.toString()),
      street: street.toString().trim(),
      city: city.toString().trim(),
      state: state.toString().trim(),
      pincode: pincode.toString().trim(),
      landmark: landmark ? landmark.toString().trim() : undefined,
      isDefault: makeDefault,
    });

    await user.save();

    const newAddr = user.addresses[user.addresses.length - 1];
    res.status(201).json({ success: true, data: formatAddress(newAddr) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/addresses/:id
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid address id' });
    }

    const user = await User.findById(req.user._id).select('addresses');
    const addr = user.addresses.id(id);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    const error = validateAddressFields(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { type, name, phone, street, city, state, pincode, landmark } = req.body;

    addr.type = type || addr.type;
    addr.name = name.toString().trim();
    addr.phone = formatPhoneNumber(phone.toString());
    addr.street = street.toString().trim();
    addr.city = city.toString().trim();
    addr.state = state.toString().trim();
    addr.pincode = pincode.toString().trim();
    addr.landmark = landmark ? landmark.toString().trim() : undefined;

    await user.save();
    res.json({ success: true, data: formatAddress(addr) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/addresses/:id
const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid address id' });
    }

    const user = await User.findById(req.user._id).select('addresses');
    const addr = user.addresses.id(id);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    const wasDefault = addr.isDefault;
    addr.deleteOne();

    // Promote the first remaining address to default if the deleted one was default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ success: true, message: 'Address deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/addresses/:id/default
const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid address id' });
    }

    const user = await User.findById(req.user._id).select('addresses');
    const addr = user.addresses.id(id);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
    addr.isDefault = true;

    await user.save();
    res.json({ success: true, data: formatAddress(addr) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };
