const CustomerLedger = require('../models/CustomerLedger');
const { formatPhoneNumber } = require('../utils/otp.util');

/**
 * Get or create a ledger for a customer by phone number.
 * If a User ref is provided it is stored on the ledger.
 */
const getOrCreateLedger = async ({ phone, name, businessName, gstin, userId }) => {
  const normalizedPhone = formatPhoneNumber(phone.toString());

  let ledger = await CustomerLedger.findOne({ phone: normalizedPhone });
  if (!ledger) {
    ledger = new CustomerLedger({
      phone: normalizedPhone,
      name: name || '',
      businessName: businessName || '',
      gstin: gstin || '',
      customer: userId || undefined,
    });
    await ledger.save();
  } else {
    // keep ledger in sync with latest user data
    let changed = false;
    if (userId && !ledger.customer) { ledger.customer = userId; changed = true; }
    if (name && !ledger.name) { ledger.name = name; changed = true; }
    if (businessName && !ledger.businessName) { ledger.businessName = businessName; changed = true; }
    if (changed) await ledger.save();
  }

  return ledger;
};

/**
 * Add a debit entry (money owed by customer) to their ledger.
 * Returns the updated ledger.
 */
const addDebit = async ({
  phone,
  name,
  businessName,
  gstin,
  userId,
  amount,
  description,
  orderId,
  invoiceNumber,
  note,
  createdBy,
  createdByRole = 'system',
}) => {
  const ledger = await getOrCreateLedger({ phone, name, businessName, gstin, userId });

  ledger.entries.push({
    type: 'debit',
    amount,
    description,
    orderId: orderId || undefined,
    invoiceNumber: invoiceNumber || undefined,
    note: note || undefined,
    createdBy: createdBy || undefined,
    createdByRole,
    date: new Date(),
  });

  ledger.recomputeBalance();
  if (orderId) ledger.lastOrderAt = new Date();
  await ledger.save();

  return ledger;
};

/**
 * Add a credit entry (payment received) to customer's ledger.
 * Returns the updated ledger.
 */
const addCredit = async ({
  phone,
  userId,
  amount,
  description,
  orderId,
  invoiceNumber,
  paymentLinkId,
  paymentMethod,
  referenceId,
  note,
  createdBy,
  createdByRole = 'system',
}) => {
  const normalizedPhone = formatPhoneNumber(phone.toString());
  const ledger = await CustomerLedger.findOne({ phone: normalizedPhone });

  if (!ledger) {
    throw new Error(`No ledger found for phone ${normalizedPhone}`);
  }

  ledger.entries.push({
    type: 'credit',
    amount,
    description,
    orderId: orderId || undefined,
    invoiceNumber: invoiceNumber || undefined,
    paymentLinkId: paymentLinkId || undefined,
    paymentMethod: paymentMethod || undefined,
    referenceId: referenceId || undefined,
    note: note || undefined,
    createdBy: createdBy || undefined,
    createdByRole,
    date: new Date(),
  });

  ledger.recomputeBalance();
  ledger.lastPaymentAt = new Date();

  // Unblock customer automatically if balance drops below limit or limit is 0
  if (ledger.isOrderBlocked) {
    if (ledger.creditLimit === 0 || ledger.outstandingBalance <= ledger.creditLimit) {
      ledger.isOrderBlocked = false;
    }
  }

  await ledger.save();
  return ledger;
};

/**
 * Check if a customer is blocked from placing orders.
 * Returns { blocked: Boolean, reason: String }
 */
const checkOrderBlock = async (phone) => {
  const normalizedPhone = formatPhoneNumber(phone.toString());
  const ledger = await CustomerLedger.findOne({ phone: normalizedPhone }).select(
    'isOrderBlocked outstandingBalance creditLimit'
  );

  if (!ledger) return { blocked: false };

  if (ledger.isOrderBlocked) {
    return {
      blocked: true,
      reason: `Account blocked. Outstanding balance ₹${ledger.outstandingBalance.toLocaleString('en-IN')} exceeds credit limit.`,
      outstandingBalance: ledger.outstandingBalance,
      creditLimit: ledger.creditLimit,
    };
  }

  return { blocked: false, outstandingBalance: ledger.outstandingBalance };
};

/**
 * Get full ledger for a customer by phone.
 */
const getLedgerByPhone = async (phone) => {
  const normalizedPhone = formatPhoneNumber(phone.toString());
  return CustomerLedger.findOne({ phone: normalizedPhone });
};

module.exports = {
  getOrCreateLedger,
  addDebit,
  addCredit,
  checkOrderBlock,
  getLedgerByPhone,
};
