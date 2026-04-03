/**
 * Billing-specific WhatsApp messaging service.
 * Renders templates, sends via the active WhatsApp provider, and logs everything.
 */
const whatsAppProvider = require('./whatsapp/whatsapp.provider');
const WhatsAppLog = require('../models/WhatsAppLog');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');

const FALLBACK_TEMPLATES = {
  invoice_sent: {
    body: `Hello {{customerName}},\n\nYour order *#{{invoiceNumber}}* has been placed successfully.\n\n*Amount: Rs {{amountDue}}*\n\nView your detailed bill here:\n{{paymentLink}}\n\nThank you for shopping with us!\n- {{businessName}}`,
    variables: ['customerName', 'invoiceNumber', 'amountDue', 'paymentLink', 'businessName'],
  },
  payment_reminder: {
    body: `Hello {{customerName}},\n\nThis is a friendly reminder that *Rs {{amountDue}}* is pending on your account.\n\nView bill and pay here:\n{{paymentLink}}\n\n- {{businessName}}`,
    variables: ['customerName', 'amountDue', 'paymentLink', 'businessName'],
  },
  payment_confirmed: {
    body: `Payment received.\n\n*Rs {{amountPaid}}* received for Bill *#{{invoiceNumber}}*.\n\nRemaining balance: *Rs {{amountDue}}*\n\nView your updated bill here:\n{{paymentLink}}\n\nThank you.\n- {{businessName}}`,
    variables: ['customerName', 'amountPaid', 'invoiceNumber', 'amountDue', 'paymentLink', 'businessName'],
  },
  order_status_update: {
    body: `Hello {{customerName}},\n\nYour order *#{{orderNumber}}* is now *{{status}}*.\n\n{{statusNote}}\n\n- {{businessName}}`,
    variables: ['customerName', 'orderNumber', 'status', 'statusNote', 'businessName'],
  },
};

const TEMPLATE_NAME_OVERRIDES = {
  invoice_sent: process.env.META_TEMPLATE_INVOICE_SENT,
  payment_reminder: process.env.META_TEMPLATE_PAYMENT_REMINDER,
  payment_confirmed: process.env.META_TEMPLATE_PAYMENT_CONFIRMED,
  order_status_update: process.env.META_TEMPLATE_ORDER_STATUS_UPDATE,
};

const renderTemplate = (body, variables = {}) => {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
};

const resolveTemplateDefinition = async (templateKey) => {
  let dbTemplate;
  try {
    dbTemplate = await WhatsAppTemplate.findOne({ key: templateKey, isActive: true }).lean();
  } catch (_) {
    dbTemplate = null;
  }

  const fallback = FALLBACK_TEMPLATES[templateKey];
  return {
    body: dbTemplate?.body || fallback?.body,
    variables: Array.isArray(dbTemplate?.variables) && dbTemplate.variables.length > 0
      ? dbTemplate.variables
      : fallback?.variables || [],
  };
};

const buildTemplatePayload = (templateKey, variables, templateDefinition) => {
  const templateName = TEMPLATE_NAME_OVERRIDES[templateKey] || templateKey;
  const bodyParameters = (templateDefinition.variables || []).map((key) => variables[key] ?? '');

  return {
    templateName,
    bodyParameters,
  };
};

const sendBillingMessage = async ({
  phone,
  customerName,
  messageType,
  templateKey,
  variables = {},
  ledgerId,
  orderId,
  paymentLinkId,
  sentBy,
  sentByRole = 'system',
}) => {
  const templateDefinition = await resolveTemplateDefinition(templateKey);

  if (!templateDefinition.body) {
    console.warn(`[billing.whatsapp] No template found for key: ${templateKey}`);
    return null;
  }

  const renderedBody = renderTemplate(templateDefinition.body, variables);

  const log = new WhatsAppLog({
    phone,
    customerName,
    ledgerId: ledgerId || undefined,
    orderId: orderId || undefined,
    paymentLinkId: paymentLinkId || undefined,
    messageType,
    templateKey,
    renderedBody,
    status: 'queued',
    sentBy: sentBy || undefined,
    sentByRole,
  });
  await log.save();

  try {
    let result;

    if (whatsAppProvider.supportsTemplateDelivery()) {
      const payload = buildTemplatePayload(templateKey, variables, templateDefinition);
      result = await whatsAppProvider.sendTemplate(phone, payload.templateName, {
        bodyParameters: payload.bodyParameters,
      });
    } else {
      const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.jpeg`;
      if (['invoice_sent', 'payment_confirmed'].includes(templateKey)) {
        result = await whatsAppProvider.sendFileByUrl(phone, logoUrl, 'BillPreview.jpeg', renderedBody);
      } else {
        result = await whatsAppProvider.sendMessage(phone, renderedBody);
      }
    }

    if (!result?.success) {
      throw new Error(result?.error || 'Unknown WhatsApp provider error');
    }

    log.status = 'sent';
    log.sentAt = new Date();
    if (result.messageId) {
      log.greenApiMessageId = result.messageId;
    }
    await log.save();
    return log;
  } catch (err) {
    log.status = 'failed';
    log.failedReason = err.message || 'Unknown error';
    await log.save();
    console.error(`[billing.whatsapp] Failed to send to ${phone}:`, err.message);
    return log;
  }
};

const sendInvoiceMessage = async ({
  phone,
  customerName,
  businessName,
  invoiceNumber,
  amountDue,
  paymentLink,
  ledgerId,
  orderId,
  paymentLinkId,
  sentBy,
}) => {
  return sendBillingMessage({
    phone,
    customerName,
    messageType: 'invoice_sent',
    templateKey: 'invoice_sent',
    variables: {
      customerName: customerName || 'Customer',
      invoiceNumber,
      amountDue: Number(amountDue).toLocaleString('en-IN'),
      paymentLink,
      businessName: businessName || 'Us',
    },
    ledgerId,
    orderId,
    paymentLinkId,
    sentBy,
    sentByRole: sentBy ? 'admin' : 'system',
  });
};

const sendPaymentConfirmation = async ({
  phone,
  customerName,
  businessName,
  invoiceNumber,
  amountPaid,
  amountDue,
  paymentLink,
  ledgerId,
  orderId,
  paymentLinkId,
}) => {
  return sendBillingMessage({
    phone,
    customerName,
    messageType: 'payment_confirmed',
    templateKey: 'payment_confirmed',
    variables: {
      customerName: customerName || 'Customer',
      amountPaid: Number(amountPaid).toLocaleString('en-IN'),
      invoiceNumber: invoiceNumber || '',
      amountDue: Number(amountDue).toLocaleString('en-IN'),
      paymentLink,
      businessName: businessName || 'Us',
    },
    ledgerId,
    orderId,
    paymentLinkId,
    sentByRole: 'system',
  });
};

const sendPaymentReminder = async ({
  phone,
  customerName,
  businessName,
  amountDue,
  paymentLink,
  ledgerId,
  paymentLinkId,
  sentBy,
}) => {
  return sendBillingMessage({
    phone,
    customerName,
    messageType: 'payment_reminder',
    templateKey: 'payment_reminder',
    variables: {
      customerName: customerName || 'Customer',
      amountDue: Number(amountDue).toLocaleString('en-IN'),
      paymentLink,
      businessName: businessName || 'Us',
    },
    ledgerId,
    paymentLinkId,
    sentBy,
    sentByRole: sentBy ? 'admin' : 'system',
  });
};

const sendOrderStatusUpdate = async ({
  phone,
  customerName,
  businessName,
  orderNumber,
  status,
  statusNote,
  orderId,
  sentBy,
}) => {
  return sendBillingMessage({
    phone,
    customerName,
    messageType: 'order_status_update',
    templateKey: 'order_status_update',
    variables: {
      customerName: customerName || 'Customer',
      orderNumber,
      status,
      statusNote: statusNote || '',
      businessName: businessName || 'Us',
    },
    orderId,
    sentBy,
    sentByRole: sentBy ? 'admin' : 'system',
  });
};

module.exports = {
  sendBillingMessage,
  sendInvoiceMessage,
  sendPaymentConfirmation,
  sendPaymentReminder,
  sendOrderStatusUpdate,
  renderTemplate,
};
