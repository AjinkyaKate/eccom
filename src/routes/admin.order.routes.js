const express = require('express');
const {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderPayment,
  adminCreateOrder,
  getOrderInvoicePdf,
} = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/', getAdminOrders);
router.post('/create', adminCreateOrder);
router.get('/:id', getAdminOrderById);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/payment', updateOrderPayment);
router.get('/:id/invoice/pdf', getOrderInvoicePdf);

module.exports = router;
