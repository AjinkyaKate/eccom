const express = require('express');
const {
  getCheckoutSummary,
  checkout,
  getMyOrders,
  getMyOrderById,
  cancelOrder,
} = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/checkout/summary', getCheckoutSummary);
router.post('/checkout', checkout);
router.get('/', getMyOrders);
router.get('/:id', getMyOrderById);
router.post('/:id/cancel', cancelOrder);

module.exports = router;
