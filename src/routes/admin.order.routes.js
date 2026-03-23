const express = require('express');
const {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderPayment,
} = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/', getAdminOrders);
router.get('/:id', getAdminOrderById);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/payment', updateOrderPayment);

module.exports = router;
