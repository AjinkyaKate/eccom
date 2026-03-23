/**
 * Admin-only middleware
 * Checks if authenticated user has admin role
 * Use after 'protect' middleware
 */
const adminOnly = (req, res, next) => {
  try {
    // Check if user exists (from protect middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Admin Middleware Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = { adminOnly };
