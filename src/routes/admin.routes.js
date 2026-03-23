const express = require('express');
const { adminLogin, getAdminProfile } = require('../controllers/admin.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();

// Public route - Admin login
router.post('/login', adminLogin);

// Protected routes - Admin only
router.get('/me', protect, adminOnly, getAdminProfile);

module.exports = router;
