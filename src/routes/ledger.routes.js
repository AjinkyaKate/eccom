const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');
const ctrl = require('../controllers/ledger.controller');

// All ledger routes require admin
router.use(protect, adminOnly);

// Billing stats dashboard
router.get('/stats', ctrl.getBillingStats);

// Customer ledgers
router.get('/customers', ctrl.listLedgers);
router.post('/customers', ctrl.upsertLedger);
router.get('/customers/:id', ctrl.getLedger);
router.patch('/customers/:id', ctrl.upsertLedger);
router.patch('/customers/:id/block', ctrl.toggleOrderBlock);

// Ledger entries
router.post('/customers/:id/debit', ctrl.addManualDebit);
router.post('/customers/:id/payment', ctrl.recordManualPayment);

// Payment links
router.post('/customers/:id/payment-link', ctrl.createPaymentLinkForLedger);

// WhatsApp
router.post('/customers/:id/whatsapp', ctrl.sendWhatsAppRequest);

// Bulk import
router.post('/import', ctrl.bulkImport);

// WhatsApp Templates
router.get('/templates', ctrl.listTemplates);
router.post('/templates', ctrl.upsertTemplate);
router.delete('/templates/:id', ctrl.deleteTemplate);

// WhatsApp Logs
router.get('/whatsapp-logs', ctrl.listWhatsAppLogs);

module.exports = router;
