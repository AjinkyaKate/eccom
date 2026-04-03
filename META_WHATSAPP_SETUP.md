# Meta WhatsApp Setup

This project now supports the official Meta WhatsApp Cloud API for:

- customer login OTP
- invoice / payment reminders
- payment confirmation
- order status updates

## 1. Meta assets you need

- Meta Business portfolio
- Meta app with the WhatsApp product enabled
- One WhatsApp Business Account (WABA)
- One phone number connected to Cloud API
- Permanent system-user access token with:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`

## 2. Backend environment variables

Add these to your backend `.env`:

```env
WHATSAPP_PROVIDER=meta
OTP_MOCK_MODE=false

META_GRAPH_API_VERSION=v23.0
META_ACCESS_TOKEN=replace_me
META_PHONE_NUMBER_ID=replace_me
META_WABA_ID=replace_me
META_APP_SECRET=replace_me
META_VERIFY_TOKEN=replace_me
META_TEMPLATE_LANGUAGE=en_US

META_TEMPLATE_OTP=auth_otp_login
META_TEMPLATE_INVOICE_SENT=invoice_sent
META_TEMPLATE_PAYMENT_REMINDER=payment_reminder
META_TEMPLATE_PAYMENT_CONFIRMED=payment_confirmed
META_TEMPLATE_ORDER_STATUS_UPDATE=order_status_update
```

## 3. Configure webhook in Meta

Use this callback URL:

```text
https://your-backend-domain/api/webhooks/whatsapp
```

Use this verify token:

```text
META_VERIFY_TOKEN
```

Subscribe the app/WABA to message events.

The backend handles:

- GET verification
- POST signature validation using `META_APP_SECRET`
- status sync for `sent`, `delivered`, `read`, `failed`

## 4. Create message templates in WhatsApp Manager

Create these templates with the exact names below.

### OTP template

Name: `auth_otp_login`

Suggested body:

```text
Your login code is {{1}}.
This code expires in {{2}} minutes.
Do not share this code with anyone.
```

Category:

- preferred: `Authentication`
- acceptable if you are still testing: a regular approved template with the same variables

### Invoice sent

Name: `invoice_sent`

Body:

```text
Hello {{1}},

Your order #{{2}} has been placed successfully.
Amount due: Rs {{3}}

View your bill here:
{{4}}

Thank you for shopping with us.
- {{5}}
```

### Payment reminder

Name: `payment_reminder`

Body:

```text
Hello {{1}},

This is a reminder that Rs {{2}} is pending on your account.

Pay here:
{{3}}

- {{4}}
```

### Payment confirmed

Name: `payment_confirmed`

Body:

```text
Hello {{1}},

We received Rs {{2}} for invoice #{{3}}.
Remaining balance: Rs {{4}}

View details:
{{5}}

- {{6}}
```

### Order status update

Name: `order_status_update`

Body:

```text
Hello {{1}},

Your order #{{2}} is now {{3}}.

{{4}}

- {{5}}
```

## 5. Public deployment requirement

Meta must reach your webhook over public HTTPS.

For local testing use one of:

- deployed backend
- `ngrok`
- `cloudflared tunnel`

## 6. Current backend behavior

- OTP send: `POST /api/auth/send-otp`
- OTP verify: `POST /api/auth/verify-otp`
- Order status WhatsApp send: automatic on admin status update
- Billing/payment template sends: automatic from existing billing flows
- Delivery/read receipts: stored in `WhatsAppLog`

## 7. Important note about your current phone number

If the same number is already actively used in the WhatsApp Business mobile app, Meta onboarding rules may require migration or a different number depending on your account flow. If Meta does not let you attach that number directly in Cloud API onboarding, use a dedicated API number instead.
