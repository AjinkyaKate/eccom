# E-Commerce Backend with WhatsApp OTP Authentication

A production-ready Node.js backend for e-commerce with WhatsApp OTP authentication.

## 🚀 Tech Stack

- **Node.js** + **Express.js**
- **MongoDB** (Database)
- **Green API** (WhatsApp OTP - temporary, will migrate to Meta Business API)
- **JWT** (Authentication)

## 📁 Project Structure

```
eccom/
├── src/
│   ├── config/          # Database configuration
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── controllers/     # Route controllers
│   ├── services/        # External services (WhatsApp)
│   ├── middlewares/     # Custom middlewares
│   └── utils/           # Utility functions
├── server.js            # Entry point
├── .env                 # Environment variables
└── package.json
```

## 🛠️ Setup Instructions

### 1. Install MongoDB

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Linux:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**Windows:**
Download from https://www.mongodb.com/try/download/community

### 2. Get Green API Credentials

1. Go to https://green-api.com
2. Sign up for free account
3. Create a new instance
4. Get your `Instance ID` and `API Token`
5. Scan QR code with your WhatsApp (the number you'll use for testing)

### 3. Configure Environment

Update `.env` file with your Green API credentials:

```env
GREEN_API_INSTANCE_ID=your-instance-id-here
GREEN_API_TOKEN=your-api-token-here
```

### 4. Install Dependencies & Run

```bash
npm install
npm run dev
```

Server will start on: http://localhost:5000

## 📡 API Endpoints

### 1. Send OTP
**POST** `/api/auth/send-otp`

Request:
```json
{
  "phone": "+919876543210"
}
```

Response:
```json
{
  "success": true,
  "message": "OTP sent successfully to WhatsApp",
  "data": {
    "phone": "+919876543210",
    "expiresIn": "5 minutes"
  }
}
```

### 2. Verify OTP
**POST** `/api/auth/verify-otp`

Request:
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "phone": "+919876543210",
      "isVerified": true
    }
  }
}
```

### 3. Get Current User (Protected)
**GET** `/api/auth/me`

Headers:
```
Authorization: Bearer <your-jwt-token>
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "phone": "+919876543210",
      "isVerified": true,
      "createdAt": "2026-03-10T..."
    }
  }
}
```

## 🧪 Testing with Postman

### Import Collection Steps:

1. Open Postman
2. Click **Import** button
3. Select **Raw text** tab
4. Copy the JSON below and paste
5. Click **Import**

### Postman Collection JSON:

```json
{
  "info": {
    "name": "E-Commerce WhatsApp Auth",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000",
      "type": "string"
    },
    {
      "key": "token",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "1. Send OTP",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    console.log('OTP sent successfully!');",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"phone\": \"+919876543210\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/send-otp",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "send-otp"]
            }
          }
        },
        {
          "name": "2. Verify OTP",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    var jsonData = pm.response.json();",
                  "    pm.collectionVariables.set('token', jsonData.data.token);",
                  "    console.log('Token saved:', jsonData.data.token);",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"phone\": \"+919876543210\",\n  \"otp\": \"123456\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/verify-otp",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "verify-otp"]
            }
          }
        },
        {
          "name": "3. Get Current User",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/auth/me",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "me"]
            }
          }
        }
      ]
    },
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/health",
          "host": ["{{baseUrl}}"],
          "path": ["health"]
        }
      }
    }
  ]
}
```

## 🔒 Security Features

- Rate limiting on OTP attempts (max 3)
- OTP expiry (5 minutes)
- JWT token authentication
- Phone number validation
- Protected routes with middleware

## ⚠️ WhatsApp Ban Prevention

**Safe Testing Practices:**
- ✅ Send max 10-20 OTPs per day
- ✅ Add 1-2 minute delays between messages
- ✅ Test only with 3-5 numbers
- ✅ Test during normal hours (9am-9pm)
- ⚠️ Using personal number - get test SIM ASAP

## 🔄 Migration Plan

**Current:** Green API (unofficial, testing only)
**Future:** Meta WhatsApp Business API (production)

The code is modular - just swap the service in `whatsapp.provider.js` when approved.

## 📝 Next Steps

1. Apply for Meta WhatsApp Business API (start now - takes 2-4 weeks)
2. Get dedicated test SIM card
3. Add more e-commerce features:
   - Products CRUD
   - Cart management
   - Orders & checkout
   - Payment integration

## 🆘 Troubleshooting

**MongoDB connection error:**
```bash
brew services restart mongodb-community
```

**Green API not sending:**
- Check instance is "authorized" in Green API dashboard
- Verify phone number format includes country code
- Check API credentials in .env

**Port already in use:**
```bash
# Change PORT in .env file
PORT=3000
```
