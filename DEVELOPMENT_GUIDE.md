# Development Quick Reference

## 🚀 Current Status

### ✅ Completed
- Authentication with WhatsApp OTP
- User model with addresses
- JWT token management
- Protected routes
- Postman collection
- MongoDB setup
- Server running

### 🔄 Next Phase: Admin System
**Goal:** Build admin authentication and middleware

---

## 📂 Project Structure

```
eccom/
├── src/
│   ├── config/
│   │   └── database.js ✅
│   ├── models/
│   │   ├── User.js ✅
│   │   ├── Category.js ⏳
│   │   ├── Product.js ⏳
│   │   ├── Cart.js ⏳
│   │   └── Order.js ⏳
│   ├── controllers/
│   │   ├── auth.controller.js ✅
│   │   ├── admin.controller.js ⏳
│   │   ├── category.controller.js ⏳
│   │   ├── product.controller.js ⏳
│   │   ├── cart.controller.js ⏳
│   │   └── order.controller.js ⏳
│   ├── routes/
│   │   ├── auth.routes.js ✅
│   │   ├── admin.routes.js ⏳
│   │   ├── category.routes.js ⏳
│   │   ├── product.routes.js ⏳
│   │   ├── cart.routes.js ⏳
│   │   └── order.routes.js ⏳
│   ├── middlewares/
│   │   ├── auth.middleware.js ✅
│   │   ├── admin.middleware.js ⏳
│   │   └── validate.middleware.js ⏳
│   ├── services/
│   │   ├── whatsapp/ ✅
│   │   └── whatsapp order/status notification helpers ⏳
│   └── utils/
│       ├── otp.util.js ✅
│       ├── jwt.util.js ✅
│       └── pagination.util.js ⏳
├── .env ✅
├── server.js ✅
├── package.json ✅
├── PROJECT_PLAN.md ✅
└── README.md ✅
```

Legend: ✅ Done | ⏳ Pending

---

## 🗄️ Database Schema Quick Reference

### Users
```javascript
{
  phone: String (unique),
  name: String,
  email: String,
  role: 'customer' | 'admin',
  password: String (admin only),
  addresses: [{ type, name, phone, street, city, state, pincode }],
  isVerified: Boolean,
  isActive: Boolean
}
```

### Categories
```javascript
{
  name: String (unique),
  slug: String (unique, auto),
  description: String,
  image: String,
  isActive: Boolean
}
```

### Products
```javascript
{
  name: String,
  slug: String (unique, auto),
  description: String,
  category: ObjectId → Category,
  price: Number,
  discountPrice: Number,
  images: [String],
  stock: Number,
  sku: String (unique),
  specifications: Object,
  isActive: Boolean,
  isFeatured: Boolean,
  rating: { average, count }
}
```

### Cart
```javascript
{
  user: ObjectId → User (unique),
  items: [{
    product: ObjectId → Product,
    quantity: Number,
    price: Number (snapshot)
  }]
}
```

### Orders
```javascript
{
  orderNumber: String (auto: ORD-YYYYMMDD-XXXX),
  user: ObjectId → User,
  items: [{ product, name, price, quantity }],
  shippingAddress: Object,
  pricing: { subtotal, shippingCharges: 50, total },
  payment: { method: 'COD', status: 'pending' },
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  statusHistory: [{ status, timestamp, note }]
}
```

---

## 🔗 API Routes Overview

### Authentication (Customer)
```
POST   /api/auth/send-otp         - Send OTP
POST   /api/auth/verify-otp       - Verify & login
GET    /api/auth/me               - Get profile (protected)
PUT    /api/auth/profile          - Update profile (protected)
POST   /api/auth/addresses        - Add address (protected)
GET    /api/auth/addresses        - List addresses (protected)
PUT    /api/auth/addresses/:id    - Update address (protected)
DELETE /api/auth/addresses/:id    - Delete address (protected)
```

### Admin Authentication
```
POST   /api/admin/login           - Admin login (email + password)
GET    /api/admin/me              - Get admin profile (admin)
```

### Categories
```
GET    /api/categories            - List all (public)
GET    /api/categories/:slug      - Get one (public)
POST   /api/admin/categories      - Create (admin)
PUT    /api/admin/categories/:id  - Update (admin)
DELETE /api/admin/categories/:id  - Delete (admin)
```

### Products
```
GET    /api/products                   - List with filters (public)
GET    /api/products/search            - Search (public)
GET    /api/products/:slug             - Get one (public)
POST   /api/admin/products             - Create (admin)
PUT    /api/admin/products/:id         - Update (admin)
PATCH  /api/admin/products/:id/stock   - Update stock (admin)
DELETE /api/admin/products/:id         - Delete (admin)
```

### Cart
```
GET    /api/cart                  - Get cart (protected)
POST   /api/cart/add              - Add item (protected)
PUT    /api/cart/items/:itemId    - Update quantity (protected)
DELETE /api/cart/items/:itemId    - Remove item (protected)
DELETE /api/cart                  - Clear cart (protected)
```

### Orders
```
POST   /api/orders/checkout       - Place order (protected)
GET    /api/orders                - Order history (protected)
GET    /api/orders/:id            - Order details (protected)
POST   /api/orders/:id/cancel     - Cancel order (protected)
```

### Admin Orders
```
GET    /api/admin/orders                - All orders (admin)
GET    /api/admin/orders/:id            - Order details (admin)
PUT    /api/admin/orders/:id/status     - Update status (admin)
GET    /api/admin/orders/analytics      - Analytics (admin)
```

### Dashboard
```
GET    /api/admin/dashboard/stats       - Dashboard stats (admin)
```

---

## 🔐 Middleware Usage

### Protect Route (Customer Auth)
```javascript
const { protect } = require('../middlewares/auth.middleware');

router.get('/cart', protect, getCart);
```

### Admin Only Route
```javascript
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

router.post('/products', protect, adminOnly, createProduct);
```

---

## 📊 Development Phases

### Phase 2: Admin System (NEXT - 2-3 days)
**Files to create:**
- `src/middlewares/admin.middleware.js`
- `src/controllers/admin.controller.js`
- `src/routes/admin.routes.js`

**Tasks:**
1. Add password field to User model
2. Create admin login controller
3. Create admin middleware
4. Create admin routes
5. Create seed script for first admin
6. Test in Postman

### Phase 3: Categories (1-2 days)
**Files to create:**
- `src/models/Category.js`
- `src/controllers/category.controller.js`
- `src/routes/category.routes.js`

**Tasks:**
1. Create Category model
2. Create CRUD controllers
3. Add slug auto-generation
4. Create routes
5. Test in Postman

### Phase 4: Products (3-4 days)
**Files to create:**
- `src/models/Product.js`
- `src/controllers/product.controller.js`
- `src/routes/product.routes.js`
- `src/utils/pagination.util.js`

**Tasks:**
1. Create Product model
2. Create CRUD controllers
3. Add search & filter
4. Add pagination
5. Stock management
6. Create routes
7. Test in Postman

### Phase 5: Cart (2-3 days)
**Files to create:**
- `src/models/Cart.js`
- `src/controllers/cart.controller.js`
- `src/routes/cart.routes.js`

**Tasks:**
1. Create Cart model
2. Create cart controllers
3. Stock validation
4. Price snapshot logic
5. Create routes
6. Test in Postman

### Phase 6: Orders (4-5 days)
**Files to create:**
- `src/models/Order.js`
- `src/controllers/order.controller.js`
- `src/routes/order.routes.js`
- `src/utils/orderNumber.util.js`

**Tasks:**
1. Create Order model
2. Checkout controller
3. Order number generation
4. Stock management
5. Order history
6. Cancel order
7. Address management
8. Create routes
9. Test in Postman

### Phase 7: Admin Orders (2-3 days)
**Files to update:**
- `src/controllers/admin.controller.js`
- `src/routes/admin.routes.js`

**Tasks:**
1. Order list controller
2. Update status controller
3. Analytics controller
4. Dashboard controller
5. Test in Postman

### Phase 8: WhatsApp Notifications (2-3 days)
**Files to create:**
- Extend `src/services/whatsapp/`
- Add WhatsApp message templates/helpers for order events

**Tasks:**
1. Create WhatsApp message templates
2. Add order/status send helpers using the existing WhatsApp provider
3. Integrate with order flow
4. Test all triggers

---

## 🧪 Testing Commands

### Start Server
```bash
npm run dev
```

### Test Postman
1. Import collection: `postman_collection.json`
2. Set environment variables
3. Test each endpoint

---

## 💡 Common Commands

### MongoDB
```bash
# Start MongoDB
brew services start mongodb-community

# Stop MongoDB
brew services stop mongodb-community

# Check status
brew services list

# Connect to MongoDB
mongosh

# View databases
show dbs

# Use database
use ecommerce

# View collections
show collections

# View all users
db.users.find()

# Clear collection
db.users.deleteMany({})
```

### Git (if using)
```bash
git add .
git commit -m "message"
git push
```

---

## 🔧 Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce

# JWT
JWT_SECRET=ecom-secret-key-2026-change-in-production
JWT_EXPIRE=7d

# WhatsApp
GREEN_API_INSTANCE_ID=7103541630
GREEN_API_TOKEN=590a2bbb7aa04ac7ac65ed969d1d81774853756022e641b788
WHATSAPP_PROVIDER=greenapi

# OTP
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3

# Admin (add in Phase 2)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Business
SHIPPING_CHARGES=50
CURRENCY=INR
```

---

## 📝 Code Snippets

### Standard Controller Pattern
```javascript
exports.controllerName = async (req, res) => {
  try {
    // 1. Extract data
    const { field } = req.body;

    // 2. Validation
    if (!field) {
      return res.status(400).json({
        success: false,
        message: 'Field is required'
      });
    }

    // 3. Business logic
    const result = await Model.create({ field });

    // 4. Success response
    res.status(201).json({
      success: true,
      message: 'Created successfully',
      data: { result }
    });

  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
```

### Standard Route Pattern
```javascript
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { controller } = require('../controllers/controller');

// Public routes
router.get('/', controller);

// Protected routes
router.post('/', protect, controller);

module.exports = router;
```

### Standard Model Pattern
```javascript
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
schema.index({ field: 1 });

// Methods
schema.methods.methodName = function() {
  // logic
};

module.exports = mongoose.model('ModelName', schema);
```

---

## 🎯 Key Business Rules

### Stock Management
- Reduce stock when order status = "confirmed"
- Restore stock when order cancelled
- Cannot add to cart if stock = 0
- Cannot place order if any item out of stock

### Order Status Flow
```
pending → confirmed → processing → shipped → delivered
   ↓
cancelled (only if not shipped)
```

### Pricing
- Fixed shipping: ₹50
- No discounts (initially)
- COD only (initially)

### Notifications
- Send WhatsApp on every status change
- Send order confirmation
- Send cancellation confirmation

---

## 📞 Helpful Links

- **MongoDB Docs:** https://www.mongodb.com/docs/manual/
- **Mongoose Docs:** https://mongoosejs.com/docs/
- **Express Docs:** https://expressjs.com/
- **JWT Docs:** https://jwt.io/
- **Green API Docs:** https://green-api.com/en/docs/

---

## ❓ Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :5000

# Kill process
kill -9 <PID>

# Restart server
npm run dev
```

### MongoDB connection error
```bash
# Restart MongoDB
brew services restart mongodb-community

# Check logs
tail -f /opt/homebrew/var/log/mongodb/mongo.log
```

### JWT token invalid
- Check if JWT_SECRET matches
- Check token expiry
- Verify token format in Authorization header

---

**Quick Start Next Phase:**
1. Read `PROJECT_PLAN.md` - Phase 2
2. Create admin middleware file
3. Update User model for admin password
4. Create admin login controller
5. Test in Postman
6. Move to Phase 3!

🚀 Let's build this!
