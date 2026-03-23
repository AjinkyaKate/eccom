const User = require('../models/User');
const { generateToken } = require('../utils/jwt.util');

/**
 * Admin login with email and password
 * POST /api/admin/login
 */
const adminLogin = async (req, res) => {
  try {
    const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;

    // Validate input
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find admin user by email
    const admin = await User.findOne({
      email: normalizedEmail,
      role: 'admin',
    }).select('+password');

    if (!admin || !admin.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if admin account is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: admin._id,
      phone: admin.phone,
      role: admin.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin._id,
          phone: admin.phone,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * Get current admin profile
 * GET /api/admin/me
 */
const getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user.userId).select('-password -otp');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          createdAt: admin.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Get Admin Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  adminLogin,
  getAdminProfile,
};
