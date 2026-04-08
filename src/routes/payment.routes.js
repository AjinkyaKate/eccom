const express = require('express');
const router = express.Router();
const { getPaymentPage, downloadInvoice, simulatePaymentSuccess, handleRazorpayWebhook } = require('../controllers/payment.controller');

// Public — no auth
router.get('/:token', getPaymentPage);
router.get('/:token/invoice.pdf', downloadInvoice);
router.post('/:token/test-success', simulatePaymentSuccess);

module.exports = router;
