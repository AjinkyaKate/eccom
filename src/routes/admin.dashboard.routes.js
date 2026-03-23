const express = require('express');
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);

module.exports = router;
