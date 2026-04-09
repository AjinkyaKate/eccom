const User = require('../models/User');
const whatsapp = require('../services/whatsapp/whatsapp.provider');
const { generateOTP, getOTPExpiry } = require('../utils/otp.util');
const { generateToken } = require('../utils/jwt.util');

const isMockMode = () => process.env.OTP_MOCK_MODE === 'true';
const DEFAULT_OTP_LENGTH = Math.max(4, parseInt(process.env.OTP_LENGTH || 4, 10) || 4);

/**
 * Normalize phone: strip spaces/dashes, ensure country code prefix
 * Accepts: 9876543210 / +919876543210 / 919876543210
 * Returns: 919876543210 (no + sign, for Green API)
 */
const normalizePhone = (phone = '') => {
  let cleaned = phone.toString().replace(/[\s\-().]/g, '');
  // Remove leading +
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  // If 10-digit Indian number, prepend 91
  if (/^\d{10}$/.test(cleaned)) cleaned = '91' + cleaned;
  return cleaned;
};

const validatePhone = (phone = '') => /^\d{10,15}$/.test(phone);

/**
 * Send OTP to phone via WhatsApp
 * POST /api/auth/send-otp
 */
const sendOTP = async (req, res) => {
  try {
    const raw = req.body.phone || '';
    const phone = normalizePhone(raw);

    if (!raw) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({ phone });
    }

    if (user.isMaxAttemptsExceeded()) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please try again later.',
      });
    }

    const otp = generateOTP();
    const result = await whatsapp.sendOTP(phone, otp);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP via WhatsApp',
        error: result.error,
      });
    }

    const otpExpiry = getOTPExpiry();
    user.otp = { code: otp, expiresAt: otpExpiry, attempts: 0 };
    await user.save();

    const responseData = {
      phone,
      otpLength: otp.length,
      expiresIn: `${process.env.OTP_EXPIRY_MINUTES || 5} minutes`,
      deliveryMode: result.mock ? 'mock' : 'whatsapp',
    };

    if (isMockMode() && result.debugOtp) {
      responseData.debugOtp = result.debugOtp;
    }

    res.status(200).json({
      success: true,
      message: result.mock ? 'Mock OTP generated for local testing' : 'OTP sent to your WhatsApp',
      data: responseData,
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Verify OTP and login/register user
 * POST /api/auth/verify-otp
 */
const verifyOTP = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || '');
    const otp = String(req.body.otp || '').trim();

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please request OTP first.',
      });
    }

    const isUniversalOtp = isMockMode() && otp === '1234';

    if (!isUniversalOtp && user.isMaxAttemptsExceeded()) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
      });
    }

    if (!isUniversalOtp) {
      // If OTP was expired/missing, we still want to save but not crash on attempts
      const currentAttempts = Number(user.otp?.attempts || 0);
      user.otp = { 
        ...(user.otp || {}), 
        attempts: currentAttempts + 1 
      };
      await user.save();
    }

    const currentAttemptsAfterSave = Number(user.otp?.attempts || 0);
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
    const attemptsLeft = Math.max(0, maxAttempts - currentAttemptsAfterSave);

    if (!isUniversalOtp && !user.isOTPValid(otp)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
        attemptsLeft,
      });
    }

    user.isVerified = true;
    user.otp = undefined; // Clear OTP after success
    await user.save();

    const token = generateToken({ userId: user._id, phone: user.phone });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-otp');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { sendOTP, verifyOTP, getMe };
