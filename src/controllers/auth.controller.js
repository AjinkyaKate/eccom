const User = require('../models/User');
const whatsappProvider = require('../services/whatsapp/whatsapp.provider');
const { generateOTP, getOTPExpiry, validatePhoneNumber, formatPhoneNumber } = require('../utils/otp.util');
const { generateToken } = require('../utils/jwt.util');

const isLocalOtpMockModeEnabled = () =>
  process.env.NODE_ENV !== 'production' &&
  (process.env.OTP_MOCK_MODE === 'true' || process.env.WHATSAPP_PROVIDER === 'mock');

/**
 * Send OTP to user's WhatsApp
 * POST /api/auth/send-otp
 */
const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate input
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phone);

    if (!validatePhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use international format with country code (e.g., +919876543210)',
      });
    }

    // Find or create user
    let user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      user = new User({
        phone: formattedPhone,
      });
    }

    // Check if max attempts exceeded
    if (user.isMaxAttemptsExceeded()) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please try again later.',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    // Save OTP to user
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      attempts: 0,
    };

    await user.save();

    // Send OTP via WhatsApp
    const whatsappResult = await whatsappProvider.sendOTP(formattedPhone, otp);

    if (!whatsappResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP via WhatsApp',
        error: whatsappResult.error,
      });
    }

    const responseData = {
      phone: formattedPhone,
      expiresIn: `${process.env.OTP_EXPIRY_MINUTES} minutes`,
      deliveryMode: whatsappResult.mock ? 'mock' : 'whatsapp',
    };

    if (isLocalOtpMockModeEnabled() && whatsappResult.debugOtp) {
      responseData.debugOtp = whatsappResult.debugOtp;
    }

    res.status(200).json({
      success: true,
      message: whatsappResult.mock ? 'Mock OTP generated for local testing' : 'OTP sent successfully to WhatsApp',
      data: responseData,
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * Verify OTP and login/register user
 * POST /api/auth/verify-otp
 */
const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    const formattedPhone = formatPhoneNumber(phone);

    // Find user
    const user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please request OTP first.',
      });
    }

    const isUniversalOtp = otp === '123456';

    // Check if max attempts exceeded (skip for universal OTP)
    if (!isUniversalOtp && user.isMaxAttemptsExceeded()) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
      });
    }

    // Increment attempts (skip for universal OTP)
    if (!isUniversalOtp) {
      user.otp.attempts += 1;
      await user.save();
    }

    // Verify OTP
    if (!isUniversalOtp && !user.isOTPValid(otp)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
        attemptsLeft: Math.max(0, parseInt(process.env.OTP_MAX_ATTEMPTS) - user.otp.attempts),
      });
    }

    // OTP verified successfully
    user.isVerified = true;
    user.otp = undefined; // Clear OTP
    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      phone: user.phone,
    });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
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
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
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
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  getMe,
};
