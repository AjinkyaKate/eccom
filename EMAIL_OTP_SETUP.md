# Email OTP Setup

This project now supports customer login with email OTP.

## Backend env

Set these values in `.env`:

```env
EMAIL_MOCK_MODE=false
EMAIL_FROM=your-email@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_LENGTH=4
```

## Gmail example

If you use Gmail:

- enable 2-step verification on the Google account
- create an App Password
- use that App Password as `SMTP_PASS`

## Local testing

For local testing without a real SMTP provider:

```env
EMAIL_MOCK_MODE=true
```

Then `POST /api/auth/send-otp` returns `debugOtp` in development.

## Auth API

### Send OTP

`POST /api/auth/send-otp`

```json
{
  "email": "you@example.com"
}
```

### Verify OTP

`POST /api/auth/verify-otp`

```json
{
  "email": "you@example.com",
  "otp": "1234"
}
```

## Current limitation

Customer login no longer requires a phone number, but some later checkout/order flows still expect a phone number for billing and delivery. Authentication works now; collecting customer phone during profile/checkout should be done next.
