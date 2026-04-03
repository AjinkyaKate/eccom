const express = require('express');
const router = express.Router();
const { getPaymentPage, downloadInvoice, handleRazorpayWebhook } = require('../controllers/payment.controller');

// Public — no auth
router.get('/:token', getPaymentPage);
router.get('/:token/invoice.pdf', downloadInvoice);

module.exports = router;
