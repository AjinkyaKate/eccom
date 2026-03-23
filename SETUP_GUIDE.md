# Quick Setup Guide

## 🚀 Step-by-Step Setup

### Step 1: Install MongoDB

**Check if MongoDB is already installed:**
```bash
mongod --version
```

**If not installed:**

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Linux:**
```bash
sudo apt-get update
sudo apt-get install mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**Windows:**
Download and install from: https://www.mongodb.com/try/download/community

**Verify MongoDB is running:**
```bash
mongosh
# Type 'exit' to quit
```

---

### Step 2: Get Green API Credentials (FREE)

1. **Go to:** https://green-api.com
2. **Click "Get started for free"** or "Sign Up"
3. **Create account** with email
4. **Create new instance:**
   - Click "Create Instance"
   - Name it (e.g., "ecom-test")
   - Click "Create"
5. **Scan QR Code:**
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices → Link a Device
   - Scan the QR code shown on Green API dashboard
6. **Copy credentials:**
   - Copy your `Instance ID` (looks like: 1101234567)
   - Copy your `API Token` (long string)

---

### Step 3: Configure Project

1. **Open `.env` file** in the project
2. **Replace the placeholder values:**

```env
GREEN_API_INSTANCE_ID=1101234567          # ← Your Instance ID here
GREEN_API_TOKEN=abc123xyz456...           # ← Your API Token here
```

3. **Save the file**

---

### Step 4: Install Dependencies & Run

```bash
# Install packages
npm install

# Start the server in development mode
npm run dev
```

You should see:
```
🚀 Server running on port 5000
📱 Environment: development
MongoDB Connected: localhost

📋 Available Routes:
   POST /api/auth/send-otp
   POST /api/auth/verify-otp
   GET  /api/auth/me
```

---

### Step 5: Test with Postman

#### Option A: Import Collection File
1. Open Postman
2. Click **Import** button (top left)
3. Click **File** → Select `postman_collection.json` from project folder
4. Collection imported! ✅

#### Option B: Manual Import
1. Copy the JSON from `README.md` (Postman Collection section)
2. Open Postman → Import → Raw text → Paste → Import

---

### Step 6: Test the API

1. **Health Check (Optional)**
   - GET `http://localhost:5000/health`
   - Should return `{"success": true, "message": "Server is running"}`

2. **Send OTP**
   - Open "1. Send OTP" request
   - **IMPORTANT:** Replace `+919876543210` with your actual WhatsApp number (with country code)
   - Click **Send**
   - Check your WhatsApp - you should receive OTP!

3. **Verify OTP**
   - Open "2. Verify OTP" request
   - Replace phone number
   - Replace `123456` with the OTP you received
   - Click **Send**
   - You'll get a JWT token back (saved automatically)

4. **Get User Profile**
   - Open "3. Get Current User" request
   - Click **Send** (token is auto-added from previous step)
   - See your user details!

---

## ⚠️ Important Notes

### Phone Number Format
Always use international format with `+` and country code:
- ✅ `+919876543210` (India)
- ✅ `+14155552671` (USA)
- ✅ `+447911123456` (UK)
- ❌ `9876543210` (missing country code)

### Testing Safely
- Send max 10-20 OTPs per day
- Wait 1-2 minutes between tests
- Test only with your own number initially

### Green API Dashboard
Check instance status: https://console.green-api.com
- Instance should show **"authorized"** (green)
- If shows "not authorized", scan QR code again

---

## 🐛 Troubleshooting

### "MongoDB connection error"
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# If not running, start it
brew services start mongodb-community
```

### "Green API error: 403"
- Your API credentials are wrong
- Double-check Instance ID and Token in `.env`
- Make sure no extra spaces

### "Green API error: Not authorized"
- Your instance is not linked to WhatsApp
- Go to Green API dashboard and scan QR code again

### "Port 5000 already in use"
Edit `.env`:
```env
PORT=3000
```

### "Invalid phone number"
- Must include country code starting with `+`
- Remove spaces and dashes
- Example: `+919876543210`

---

## ✅ Success Checklist

- [ ] MongoDB installed and running
- [ ] Green API account created
- [ ] QR code scanned on WhatsApp
- [ ] Instance shows "authorized" in dashboard
- [ ] `.env` file updated with credentials
- [ ] `npm install` completed successfully
- [ ] Server running on http://localhost:5000
- [ ] Postman collection imported
- [ ] OTP received on WhatsApp
- [ ] OTP verified successfully

---

## 🎯 What's Next?

Once authentication is working:

1. **Get Test SIM** - Don't use personal number long-term
2. **Apply for Meta Business API** - Start process now (takes 2-4 weeks)
3. **Add E-commerce Features:**
   - Product catalog
   - Shopping cart
   - Order management
   - Payment gateway integration

---

## 🆘 Need Help?

Common issues and solutions in README.md → Troubleshooting section.

Green API Documentation: https://green-api.com/en/docs/
