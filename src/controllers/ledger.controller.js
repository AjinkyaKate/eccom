const { v4: uuidv4 } = require('uuid');
const CustomerLedger = require('../models/CustomerLedger');
const PaymentLink = require('../models/PaymentLink');
const WhatsAppLog = require('../models/WhatsAppLog');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const BusinessSettings = require('../models/BusinessSettings');
const { addDebit, addCredit, getOrCreateLedger } = require('../services/ledger.service');
const { createPaymentLink } = require('../services/razorpay.service');
const { sendInvoiceMessage, sendPaymentReminder } = require('../services/billing.whatsapp.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const { formatPhoneNumber } = require('../utils/otp.util');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Helper ───────────────────────────────────────────────────────────────────
const buildPaymentLinkForLedger = async ({
  ledger,
  amount,
  description,
  orderId,
  ledgerEntryId,
  adminUserId,
  settings,
}) => {
  const token = uuidv4();
  const callbackUrl = `${FRONTEND_URL}/pay/${token}`;

  const link = new PaymentLink({
    token,
    ledger: ledger._id,
    orderId: orderId || undefined,
    ledgerEntryId: ledgerEntryId || undefined,
    customerPhone: ledger.phone,
    customerName: ledger.name,
    customerBusinessName: ledger.businessName,
    amount,
    description,
    status: 'active',
    amountPaid: 0,
    createdBy: adminUserId,
  });

  // Try to create Razorpay payment link (non-fatal if Razorpay not configured)
  try {
    const rzpLink = await createPaymentLink({
      amount,
      customerName: ledger.name,
      customerPhone: ledger.phone,
      description,
      referenceId: token,
      callbackUrl,
    });

    link.razorpayPaymentLinkId = rzpLink.id;
    link.razorpayPaymentLinkUrl = rzpLink.short_url || rzpLink.id;
    link.razorpayShortUrl = rzpLink.short_url;
    link.expiresAt = rzpLink.expire_by ? new Date(rzpLink.expire_by * 1000) : undefined;
  } catch (err) {
    console.warn('[ledger] Razorpay not configured — payment link created without Razorpay URL:', err.message);
    link.razorpayPaymentLinkUrl = callbackUrl;
  }

  await link.save();
  return link;
};

// ─── List all customer ledgers ─────────────────────────────────────────────────
const listLedgers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.blocked === 'true') filter.isOrderBlocked = true;
    if (req.query.search) {
      const re = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { phone: { $regex: re, $options: 'i' } },
        { name: { $regex: re, $options: 'i' } },
        { businessName: { $regex: re, $options: 'i' } },
      ];
    }

    const [ledgers, total] = await Promise.all([
      CustomerLedger.find(filter)
        .sort({ outstandingBalance: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-entries'),
      CustomerLedger.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { ledgers, pagination: buildPaginationMeta({ page, limit, totalItems: total }) },
    });
  } catch (err) {
    console.error('listLedgers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Get single customer ledger ────────────────────────────────────────────────
const getLedger = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    const [paymentLinks, whatsappLogs] = await Promise.all([
      PaymentLink.find({ ledger: ledger._id }).sort({ createdAt: -1 }).limit(20),
      WhatsAppLog.find({ ledgerId: ledger._id }).sort({ createdAt: -1 }).limit(20),
    ]);

    res.json({ success: true, data: { ledger, paymentLinks, whatsappLogs } });
  } catch (err) {
    console.error('getLedger error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Create / update customer ledger (admin) ───────────────────────────────────
const upsertLedger = async (req, res) => {
  try {
    const { phone, name, businessName, gstin, creditLimit, notes } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone is required' });

    const ledger = await getOrCreateLedger({ phone, name, businessName, gstin });

    if (creditLimit !== undefined) ledger.creditLimit = Number(creditLimit);
    if (notes !== undefined) ledger.notes = notes;
    if (name) ledger.name = name;
    if (businessName) ledger.businessName = businessName;
    if (gstin) ledger.gstin = gstin;

    // Re-evaluate block status against new credit limit
    ledger.recomputeBalance();
    await ledger.save();

    res.json({ success: true, data: { ledger } });
  } catch (err) {
    console.error('upsertLedger error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Bulk import outstanding balances ──────────────────────────────────────────
// Body: { customers: [{ phone, name, businessName, amount, note }] }
const bulkImport = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, message: 'customers array required' });
    }

    const settings = await BusinessSettings.findOne().lean();
    const results = { success: [], failed: [] };

    for (const row of customers) {
      try {
        if (!row.phone || !row.amount || Number(row.amount) <= 0) {
          results.failed.push({ phone: row.phone, reason: 'phone and amount > 0 required' });
          continue;
        }

        const ledger = await addDebit({
          phone: row.phone,
          name: row.name || '',
          businessName: row.businessName || '',
          amount: Number(row.amount),
          description: row.note || 'Opening balance import',
          note: row.note,
          createdBy: req.user.userId,
          createdByRole: 'admin',
        });

        // Auto-create payment link
        const link = await buildPaymentLinkForLedger({
          ledger,
          amount: ledger.outstandingBalance,
          description: `Outstanding balance — ${ledger.name || ledger.phone}`,
          adminUserId: req.user.userId,
          settings,
        });

        results.success.push({ phone: row.phone, ledgerId: ledger._id, token: link.token });
      } catch (rowErr) {
        results.failed.push({ phone: row.phone, reason: rowErr.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('bulkImport error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin: add manual debit entry ────────────────────────────────────────────
const addManualDebit = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    const { amount, description, note } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount > 0 required' });
    }

    ledger.entries.push({
      type: 'debit',
      amount: Number(amount),
      description: description || 'Manual debit',
      note,
      createdBy: req.user.userId,
      createdByRole: 'admin',
      date: new Date(),
    });
    ledger.recomputeBalance();
    await ledger.save();

    res.json({ success: true, data: { ledger } });
  } catch (err) {
    console.error('addManualDebit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin: record manual payment (cash/bank transfer) ────────────────────────
const recordManualPayment = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    const { amount, paymentMethod, referenceId, note, paymentLinkId } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount > 0 required' });
    }

    const updatedLedger = await addCredit({
      phone: ledger.phone,
      amount: Number(amount),
      description: `Manual payment — ${paymentMethod || 'cash'}`,
      paymentMethod: paymentMethod || 'cash',
      referenceId,
      paymentLinkId: paymentLinkId || undefined,
      note,
      createdBy: req.user.userId,
      createdByRole: 'admin',
    });

    // If paymentLinkId provided, update that link
    if (paymentLinkId) {
      const link = await PaymentLink.findById(paymentLinkId);
      if (link) {
        link.amountPaid = (link.amountPaid || 0) + Number(amount);
        const remaining = Math.max(0, link.amount - link.amountPaid);
        link.status = remaining <= 0 ? 'paid' : 'partially_paid';
        link.payments.push({
          amount: Number(amount),
          method: paymentMethod || 'cash',
          referenceId,
          status: 'captured',
          paidAt: new Date(),
        });
        await link.save();
      }
    }

    res.json({ success: true, data: { ledger: updatedLedger } });
  } catch (err) {
    console.error('recordManualPayment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Create payment link for a ledger ─────────────────────────────────────────
const createPaymentLinkForLedger = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    const amount = req.body.amount ? Number(req.body.amount) : ledger.outstandingBalance;
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'No outstanding balance to create payment link for' });
    }

    const settings = await BusinessSettings.findOne().lean();
    const link = await buildPaymentLinkForLedger({
      ledger,
      amount,
      description: req.body.description || `Outstanding — ${ledger.name || ledger.phone}`,
      adminUserId: req.user.userId,
      settings,
    });

    res.json({ success: true, data: { link, paymentUrl: `${FRONTEND_URL}/pay/${link.token}` } });
  } catch (err) {
    console.error('createPaymentLinkForLedger error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Send WhatsApp payment request / reminder ──────────────────────────────────
const sendWhatsAppRequest = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    if (ledger.outstandingBalance <= 0) {
      return res.status(400).json({ success: false, message: 'No outstanding balance' });
    }

    // Get the most recent active payment link, or create one
    let link = await PaymentLink.findOne({
      ledger: ledger._id,
      status: { $in: ['active', 'partially_paid'] },
    }).sort({ createdAt: -1 });

    const settings = await BusinessSettings.findOne().lean();

    if (!link) {
      link = await buildPaymentLinkForLedger({
        ledger,
        amount: ledger.outstandingBalance,
        description: `Outstanding — ${ledger.name || ledger.phone}`,
        adminUserId: req.user.userId,
        settings,
      });
    }

    const paymentUrl = `${FRONTEND_URL}/pay/${link.token}`;
    const isReminder = req.body.isReminder === true;

    const log = isReminder
      ? await sendPaymentReminder({
          phone: ledger.phone,
          customerName: ledger.name,
          businessName: settings?.businessName,
          amountDue: ledger.outstandingBalance,
          paymentLink: paymentUrl,
          ledgerId: ledger._id,
          paymentLinkId: link._id,
          sentBy: req.user.userId,
        })
      : await sendInvoiceMessage({
          phone: ledger.phone,
          customerName: ledger.name,
          businessName: settings?.businessName,
          invoiceNumber: link.description,
          amountDue: ledger.outstandingBalance,
          paymentLink: paymentUrl,
          ledgerId: ledger._id,
          paymentLinkId: link._id,
          sentBy: req.user.userId,
        });

    // Update reminder tracking on link
    link.lastReminderSentAt = new Date();
    link.reminderCount = (link.reminderCount || 0) + 1;
    if (!link.whatsappSentAt) link.whatsappSentAt = new Date();
    await link.save();

    res.json({
      success: true,
      message: `WhatsApp ${isReminder ? 'reminder' : 'payment request'} sent`,
      data: { log, paymentUrl },
    });
  } catch (err) {
    console.error('sendWhatsAppRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Toggle order block manually ───────────────────────────────────────────────
const toggleOrderBlock = async (req, res) => {
  try {
    const ledger = await CustomerLedger.findById(req.params.id);
    if (!ledger) return res.status(404).json({ success: false, message: 'Ledger not found' });

    ledger.isOrderBlocked = req.body.blocked === true;
    await ledger.save();

    res.json({ success: true, data: { isOrderBlocked: ledger.isOrderBlocked } });
  } catch (err) {
    console.error('toggleOrderBlock error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── WhatsApp Templates CRUD ───────────────────────────────────────────────────
const listTemplates = async (req, res) => {
  try {
    const templates = await WhatsAppTemplate.find().sort({ createdAt: 1 });
    res.json({ success: true, data: { templates } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const upsertTemplate = async (req, res) => {
  try {
    const { key, name, description, body, triggerOn, scheduleAfterDays, isActive } = req.body;
    if (!key || !name || !body) {
      return res.status(400).json({ success: false, message: 'key, name, body required' });
    }

    // Extract variable names from {{var}} placeholders
    const variables = [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

    const template = await WhatsAppTemplate.findOneAndUpdate(
      { key },
      { key, name, description, body, variables, triggerOn, scheduleAfterDays, isActive,
        updatedBy: req.user.userId },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (!template.createdBy) {
      template.createdBy = req.user.userId;
      await template.save();
    }

    res.json({ success: true, data: { template } });
  } catch (err) {
    console.error('upsertTemplate error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await WhatsAppTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (template.isSystemTemplate) {
      return res.status(403).json({ success: false, message: 'System templates cannot be deleted' });
    }
    await template.deleteOne();
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── WhatsApp Logs ─────────────────────────────────────────────────────────────
const listWhatsAppLogs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.messageType) filter.messageType = req.query.messageType;
    if (req.query.phone) filter.phone = { $regex: req.query.phone, $options: 'i' };

    const [logs, total] = await Promise.all([
      WhatsAppLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WhatsAppLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { logs, pagination: buildPaginationMeta({ page, limit, totalItems: total }) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Billing dashboard stats ───────────────────────────────────────────────────
const getBillingStats = async (req, res) => {
  try {
    const [totalOutstanding, blockedCount, recentPayments, overdueCustomers] = await Promise.all([
      CustomerLedger.aggregate([
        { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
      ]),
      CustomerLedger.countDocuments({ isOrderBlocked: true }),
      PaymentLink.find({ status: { $in: ['paid', 'partially_paid'] } })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('customerName customerPhone amountPaid amount status updatedAt'),
      CustomerLedger.find({ outstandingBalance: { $gt: 0 } })
        .sort({ outstandingBalance: -1 })
        .limit(5)
        .select('name phone businessName outstandingBalance lastOrderAt isOrderBlocked'),
    ]);

    res.json({
      success: true,
      data: {
        totalOutstanding: totalOutstanding[0]?.total || 0,
        blockedCustomers: blockedCount,
        recentPayments,
        overdueCustomers,
      },
    });
  } catch (err) {
    console.error('getBillingStats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listLedgers,
  getLedger,
  upsertLedger,
  bulkImport,
  addManualDebit,
  recordManualPayment,
  createPaymentLinkForLedger,
  sendWhatsAppRequest,
  toggleOrderBlock,
  listTemplates,
  upsertTemplate,
  deleteTemplate,
  listWhatsAppLogs,
  getBillingStats,
};
