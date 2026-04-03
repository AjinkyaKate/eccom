require('dotenv').config();
const connectDB = require('../src/config/database');
const WhatsAppTemplate = require('../src/models/WhatsAppTemplate');

const TEMPLATES = [
  {
    key: 'invoice_sent',
    name: 'Invoice Sent',
    description: 'Sent automatically when an order is placed',
    triggerOn: 'order_placed',
    isSystemTemplate: true,
    body: `Hello {{customerName}},

Your order *#{{invoiceNumber}}* has been placed.

*Amount Due: ₹{{amountDue}}*

View & Pay your invoice:
{{paymentLink}}

Thank you for your business!
— {{businessName}}`,
    variables: ['customerName', 'invoiceNumber', 'amountDue', 'paymentLink', 'businessName'],
  },
  {
    key: 'payment_reminder',
    name: 'Payment Reminder',
    description: 'Sent manually or on schedule to remind customer of outstanding balance',
    triggerOn: 'manual',
    isSystemTemplate: true,
    body: `Hello {{customerName}},

This is a friendly reminder that *₹{{amountDue}}* is pending on your account.

Pay now:
{{paymentLink}}

— {{businessName}}`,
    variables: ['customerName', 'amountDue', 'paymentLink', 'businessName'],
  },
  {
    key: 'payment_confirmed',
    name: 'Payment Confirmed',
    description: 'Sent automatically after a payment is received via Razorpay',
    triggerOn: 'payment_confirmed',
    isSystemTemplate: true,
    body: `✅ Payment received!

*₹{{amountPaid}}* received for Invoice *#{{invoiceNumber}}*.
Remaining balance: *₹{{amountDue}}*

View updated invoice:
{{paymentLink}}

Thank you! 🙏
— {{businessName}}`,
    variables: ['amountPaid', 'invoiceNumber', 'amountDue', 'paymentLink', 'businessName'],
  },
  {
    key: 'order_status_update',
    name: 'Order Status Update',
    description: 'Sent when order status changes (dispatched, delivered, etc.)',
    triggerOn: 'manual',
    isSystemTemplate: true,
    body: `Hello {{customerName}},

Your order *#{{orderNumber}}* status has been updated to *{{status}}*.

{{statusNote}}

— {{businessName}}`,
    variables: ['customerName', 'orderNumber', 'status', 'statusNote', 'businessName'],
  },
];

(async () => {
  await connectDB();

  for (const tmpl of TEMPLATES) {
    await WhatsAppTemplate.findOneAndUpdate(
      { key: tmpl.key },
      tmpl,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✅  Template seeded: ${tmpl.key}`);
  }

  console.log('\nAll WhatsApp templates seeded.');
  process.exit(0);
})();
