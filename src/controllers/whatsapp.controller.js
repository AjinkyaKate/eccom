const crypto = require('crypto');
const WhatsAppLog = require('../models/WhatsAppLog');

const normalizeWebhookBody = (rawBody) => {
  if (!rawBody) {
    return '';
  }

  return Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
};

const verifyWhatsAppWebhook = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({
    success: false,
    message: 'Webhook verification failed',
  });
};

const isValidSignature = (rawBody, signature) => {
  if (!process.env.META_APP_SECRET) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

const applyStatusUpdate = async (status) => {
  const messageId = status.id;
  if (!messageId) {
    return;
  }

  const update = {
    status: ['sent', 'delivered', 'read', 'failed'].includes(status.status) ? status.status : 'sent',
  };

  const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
  if (status.status === 'delivered') {
    update.deliveredAt = timestamp;
  }
  if (status.status === 'read') {
    update.readAt = timestamp;
  }
  if (status.status === 'failed') {
    const firstError = Array.isArray(status.errors) ? status.errors[0] : null;
    update.failedReason = firstError?.title || firstError?.message || 'WhatsApp delivery failed';
  }

  await WhatsAppLog.findOneAndUpdate({ greenApiMessageId: messageId }, update);
};

const handleWhatsAppWebhook = async (req, res) => {
  const rawBody = normalizeWebhookBody(req.rawBody || req.body);
  const signature = req.headers['x-hub-signature-256'];

  if (!isValidSignature(rawBody, signature)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature',
    });
  }

  let payload = req.body;
  if (Buffer.isBuffer(payload)) {
    payload = JSON.parse(payload.toString('utf8'));
  }

  res.status(200).json({ success: true });

  try {
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const statuses = Array.isArray(change.value?.statuses) ? change.value.statuses : [];
        for (const status of statuses) {
          await applyStatusUpdate(status);
        }
      }
    }
  } catch (error) {
    console.error('[whatsapp webhook] Error processing payload:', error.message);
  }
};

module.exports = {
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
};
