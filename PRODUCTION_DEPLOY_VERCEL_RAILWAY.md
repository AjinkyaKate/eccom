# Production Deploy: Vercel + Railway

This project is set up to run with:

- Frontend on Vercel
- Backend on Railway
- MongoDB on Atlas

The recommended order is:

1. Deploy backend to Railway
2. Copy the Railway public URL
3. Deploy frontend to Vercel using that backend URL
4. Update backend CORS and frontend URL values if your Vercel domain changes
5. Configure Razorpay and WhatsApp webhooks

## 1. Backend on Railway

Create a new Railway project and deploy the repository root:

- Root directory: `/`
- Start command: `npm start`
- Health check path: `/health`

`railway.json` is already included in the repo.

### Backend production environment variables

Set these in Railway:

```env
PORT=5000
NODE_ENV=production

MONGODB_URI=your-mongodb-atlas-uri
MONGODB_DIRECT_URI=optional-direct-uri-if-needed

JWT_SECRET=use-a-long-random-secret
JWT_EXPIRE=7d

ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://www.yourdomain.com
FRONTEND_URL=https://your-frontend.vercel.app

OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_LENGTH=4
OTP_MOCK_MODE=false

WHATSAPP_PROVIDER=meta

META_GRAPH_API_VERSION=v23.0
META_ACCESS_TOKEN=your-meta-access-token
META_PHONE_NUMBER_ID=your-meta-phone-number-id
META_WABA_ID=your-meta-waba-id
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=your-meta-verify-token
META_TEMPLATE_LANGUAGE=en_US
META_TEMPLATE_OTP=auth_otp_login
META_TEMPLATE_PAYMENT_CONFIRMED=payment_confirmed

GREEN_API_INSTANCE_ID=
GREEN_API_TOKEN=

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

RAZORPAY_KEY_ID=your-live-key-id
RAZORPAY_KEY_SECRET=your-live-key-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
```

Notes:

- `FRONTEND_URL` must be your real Vercel production URL or custom domain.
- `ALLOWED_ORIGINS` can be comma-separated.
- `WHATSAPP_PROVIDER=meta` is strongly recommended for production.
- The bill preview image used in WhatsApp must be publicly reachable. It will work in production once `FRONTEND_URL` is a public HTTPS domain.

### Railway sanity checks

After deploy, verify:

- `GET https://your-backend.up.railway.app/health`
- `GET https://your-backend.up.railway.app/api/pay/<token>`

## 2. Frontend on Vercel

Create a new Vercel project and point it to the `frontend` directory:

- Framework: Next.js
- Root directory: `frontend`
- Install command: default
- Build command: `npm run build`
- Output: default Next.js output

### Frontend production environment variables

Set this in Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app
```

If you later attach a custom backend domain, update this value to that domain.

### Vercel sanity checks

After deploy, verify:

- `https://your-frontend.vercel.app/`
- `https://your-frontend.vercel.app/pay/<token>`
- `https://your-frontend.vercel.app/api/pay/<token>/preview-image.png`

## 3. Razorpay production setup

In Razorpay:

- Use live keys in Railway env vars
- Set the callback URLs naturally through app-generated links
- Add webhook URL:

```text
https://your-backend.up.railway.app/api/webhooks/razorpay
```

- Use the same webhook secret value in:

```env
RAZORPAY_WEBHOOK_SECRET=...
```

After setup, confirm:

- a successful payment marks the payment link paid
- an order is created
- one WhatsApp payment confirmation is sent

## 4. Meta WhatsApp production setup

In Meta:

- Webhook verify URL:

```text
https://your-backend.up.railway.app/api/webhooks/whatsapp
```

- Verify token must match:

```env
META_VERIFY_TOKEN=...
```

- App secret must match:

```env
META_APP_SECRET=...
```

Template expectations used by this app:

- `auth_otp_login`
- `payment_confirmed`

The current paid-order confirmation flow sends one post-payment message and can attach the bill preview image URL if the provider supports it.

## 5. Recommended custom domains

Recommended:

- Frontend: `www.yourdomain.com`
- Backend: `api.yourdomain.com`

If you add custom domains:

- update `NEXT_PUBLIC_API_BASE_URL` in Vercel
- update `FRONTEND_URL` in Railway
- update `ALLOWED_ORIGINS` in Railway
- update Razorpay and Meta webhook URLs if they point to old domains

## 6. Post-deploy checklist

Run these checks in production:

1. Customer login OTP sends successfully
2. Customer storefront loads products and categories
3. Checkout creates payment session
4. Paid order opens the bill preview page, not a forced download
5. Print works from the bill preview page
6. WhatsApp sends exactly one post-payment confirmation
7. Admin billing URLs redirect cleanly
8. Admin new order page works without billing lookup
9. Razorpay webhook returns success for real payments

## 7. Known production notes

- There are still pre-existing docs with encoding artifacts; that does not block deploy.
- The backend logs still show a duplicate Mongoose index warning for `CustomerLedger`; that is not a deployment blocker but should be cleaned up later.
- The app has no real automated test suite yet, so do a manual smoke test immediately after deployment.
