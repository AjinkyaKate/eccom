# E-Commerce Backend - Complete Project Plan

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Business Logic & Workflows](#business-logic--workflows)
6. [Development Phases](#development-phases)
7. [Testing Strategy](#testing-strategy)

---

## 🎯 Project Overview

### Purpose
Build a complete e-commerce backend with WhatsApp OTP authentication, product management, shopping cart, orders, and payment integration.

### Key Features
- ✅ WhatsApp OTP Authentication
- 📦 Product Management (Admin)
- 🛒 Shopping Cart
- 💳 Checkout & Orders
- 📊 Admin Dashboard
- 📱 WhatsApp Notifications

### Simplified Decisions Made
- **Admin:** 1-2 admins with shared credentials
- **Shipping:** Fixed charges (₹50 flat)
- **Payment:** COD only (initially)
- **Notifications:** WhatsApp only
- **Images:** Cloudinary (later)

---

## 💻 Technical Stack

### Backend
- **Runtime:** Node.js v22
- **Framework:** Express.js v5
- **Database:** MongoDB v8
- **Auth:** JWT (7-day expiry)
- **WhatsApp:** Green API (migrate to Meta later)

### Packages
```json
{
  "express": "^5.2.1",
  "mongoose": "^9.2.4",
  "dotenv": "^17.3.1",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",
  "axios": "^1.13.6",
  "cors": "^2.8.6",
  "express-validator": "^7.0.1",
  "multer": "^1.4.5-lts.1",
  "cloudinary": "^2.0.0"
}
```

---

## 🗄️ Database Schema

### 1. Users Collection ✅ (DONE)

**Purpose:** Store customer and admin information

```javascript
{
  _id: ObjectId,
  phone: String (unique, required),
  name: String,
  email: String,
  role: String (enum: ['customer', 'admin'], default: 'customer'),
  password: String (for admin only, hashed),
  addresses: [{
    type: { type: String, enum: ['home', 'office', 'other'] },
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String,
    isDefault: Boolean
  }],
  isVerified: Boolean,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `phone`: unique index
- `role`: regular index

---

### 2. Categories Collection

**Purpose:** Organize products into categories

```javascript
{
  _id: ObjectId,
  name: String (unique, required),
  slug: String (unique, required), // auto-generated from name
  description: String,
  image: String (URL),
  isActive: Boolean (default: true),
  displayOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `slug`: unique index
- `isActive`: regular index

**Business Rules:**
- Category names must be unique
- Slug auto-generated from name (e.g., "Electronics" → "electronics")
- Cannot delete category if products exist
- Can deactivate instead of delete

---

### 3. Products Collection

**Purpose:** Store product information

```javascript
{
  _id: ObjectId,
  name: String (required),
  slug: String (unique, required),
  description: String,
  shortDescription: String,
  category: ObjectId (ref: 'Category', required),
  price: Number (required, min: 0),
  discountPrice: Number (min: 0),
  images: [String], // URLs array
  mainImage: String, // primary image URL
  stock: Number (required, default: 0, min: 0),
  sku: String (unique, required), // Stock Keeping Unit
  specifications: {
    brand: String,
    model: String,
    weight: String,
    dimensions: String,
    // ... flexible key-value pairs
  },
  isActive: Boolean (default: true),
  isFeatured: Boolean (default: false),
  rating: {
    average: Number (default: 0, min: 0, max: 5),
    count: Number (default: 0)
  },
  soldCount: Number (default: 0),
  tags: [String],
  createdBy: ObjectId (ref: 'User'),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `slug`: unique index
- `sku`: unique index
- `category`: regular index
- `isActive`: regular index
- `isFeatured`: regular index
- `name`: text index (for search)

**Calculated Fields:**
- `finalPrice`: price - discountPrice (if discount exists)
- `discountPercentage`: ((price - discountPrice) / price) * 100
- `inStock`: stock > 0

**Business Rules:**
- SKU must be unique (e.g., "ELEC-001")
- Price cannot be negative
- Discount price must be less than regular price
- Stock cannot go negative
- When stock = 0, product marked as "Out of Stock"

---

### 4. Cart Collection

**Purpose:** Store user's shopping cart items

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User', required, unique),
  items: [{
    product: ObjectId (ref: 'Product', required),
    quantity: Number (required, min: 1, default: 1),
    price: Number (required), // snapshot at time of adding
    addedAt: Date (default: Date.now)
  }],
  updatedAt: Date
}
```

**Indexes:**
- `user`: unique index (one cart per user)

**Virtual Fields:**
- `subtotal`: sum of (item.price * item.quantity) for all items
- `totalItems`: sum of all quantities

**Business Rules:**
- One cart per user
- Cannot add same product twice (increase quantity instead)
- Quantity limited by stock availability
- Price snapshot prevents price changes after adding to cart
- Remove item if product deleted or deactivated

---

### 5. Orders Collection

**Purpose:** Store completed orders

```javascript
{
  _id: ObjectId,
  orderNumber: String (unique, required), // Auto: "ORD-20260310-0001"
  user: ObjectId (ref: 'User', required),

  items: [{
    product: ObjectId (ref: 'Product'),
    name: String, // snapshot
    sku: String, // snapshot
    price: Number, // snapshot
    quantity: Number,
    subtotal: Number, // price * quantity
    image: String // snapshot
  }],

  shippingAddress: {
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },

  pricing: {
    subtotal: Number, // sum of items
    shippingCharges: Number (default: 50),
    discount: Number (default: 0),
    total: Number // subtotal + shipping - discount
  },

  payment: {
    method: String (enum: ['COD'], default: 'COD'),
    status: String (enum: ['pending', 'paid', 'failed'], default: 'pending'),
    paidAt: Date,
    transactionId: String
  },

  status: String (
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  ),

  statusHistory: [{
    status: String,
    timestamp: Date,
    note: String,
    updatedBy: ObjectId (ref: 'User')
  }],

  notes: String, // Admin notes
  cancellationReason: String,

  deliveredAt: Date,
  cancelledAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `orderNumber`: unique index
- `user`: regular index
- `status`: regular index
- `createdAt`: descending index

**Auto-generated Fields:**
- `orderNumber`: "ORD-YYYYMMDD-XXXX" (e.g., "ORD-20260310-0001")

**Business Rules:**
- Order number unique and sequential
- Cannot modify items after order placed
- Stock reduced on order confirmation
- Stock restored on cancellation
- Cannot cancel after "shipped" status
- Status changes logged in history
- WhatsApp notification on each status change

**Status Flow:**
```
pending → confirmed → processing → shipped → delivered
   ↓
cancelled (only if not shipped)
```

---

## 🔗 API Endpoints

### Authentication APIs ✅ (DONE)

#### 1. Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

Request:
{
  "phone": "+917758880580"
}

Response (Success):
{
  "success": true,
  "message": "OTP sent successfully to WhatsApp",
  "data": {
    "phone": "+917758880580",
    "expiresIn": "5 minutes"
  }
}

Response (Error):
{
  "success": false,
  "message": "Invalid phone number format"
}
```

#### 2. Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

Request:
{
  "phone": "+917758880580",
  "otp": "123456"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "69af26b21aad6c614b114727",
      "phone": "+917758880580",
      "name": null,
      "role": "customer",
      "isVerified": true
    }
  }
}

Response (Error):
{
  "success": false,
  "message": "Invalid or expired OTP",
  "attemptsLeft": 2
}
```

#### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "phone": "+917758880580",
      "name": "John Doe",
      "email": "john@example.com",
      "addresses": [...],
      "isVerified": true,
      "createdAt": "2026-03-09T..."
    }
  }
}
```

#### 4. Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "name": "John Doe",
  "email": "john@example.com"
}

Response:
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { user }
}
```

#### 5. Manage Addresses
```http
POST /api/auth/addresses
Authorization: Bearer <token>

Request:
{
  "type": "home",
  "name": "John Doe",
  "phone": "+917758880580",
  "street": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "landmark": "Near XYZ Mall",
  "isDefault": true
}

GET /api/auth/addresses
PUT /api/auth/addresses/:id
DELETE /api/auth/addresses/:id
```

---

### Admin Authentication APIs

#### 1. Admin Login
```http
POST /api/admin/login
Content-Type: application/json

Request:
{
  "email": "admin@ecommerce.com",
  "password": "your-secure-password"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "...",
      "name": "Admin",
      "role": "admin"
    }
  }
}
```

---

### Categories APIs

#### 1. Get All Categories (Public)
```http
GET /api/categories
Query Params: ?isActive=true

Response:
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "...",
        "name": "Electronics",
        "slug": "electronics",
        "description": "...",
        "image": "https://...",
        "isActive": true,
        "productCount": 45
      }
    ]
  }
}
```

#### 2. Get Single Category
```http
GET /api/categories/:slug

Response:
{
  "success": true,
  "data": {
    "category": { ... }
  }
}
```

#### 3. Create Category (Admin)
```http
POST /api/admin/categories
Authorization: Bearer <admin-token>
Content-Type: application/json

Request:
{
  "name": "Electronics",
  "description": "Electronic items and gadgets",
  "image": "https://..."
}

Response:
{
  "success": true,
  "message": "Category created successfully",
  "data": { category }
}
```

#### 4. Update Category (Admin)
```http
PUT /api/admin/categories/:id
Authorization: Bearer <admin-token>

Request:
{
  "name": "Electronics & Gadgets",
  "isActive": true
}
```

#### 5. Delete Category (Admin)
```http
DELETE /api/admin/categories/:id
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

### Products APIs

#### 1. Get All Products (Public)
```http
GET /api/products
Query Params:
  - page=1
  - limit=20
  - category=electronics
  - minPrice=1000
  - maxPrice=50000
  - search=laptop
  - sort=price_asc | price_desc | newest | popular
  - inStock=true

Response:
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "...",
        "name": "MacBook Pro",
        "slug": "macbook-pro-m3",
        "shortDescription": "...",
        "price": 199900,
        "discountPrice": 179900,
        "finalPrice": 179900,
        "discountPercentage": 10,
        "mainImage": "https://...",
        "category": { ... },
        "stock": 15,
        "inStock": true,
        "rating": { average: 4.5, count: 120 },
        "soldCount": 450
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalProducts": 95,
      "hasMore": true
    }
  }
}
```

#### 2. Get Single Product
```http
GET /api/products/:slug

Response:
{
  "success": true,
  "data": {
    "product": {
      ... // full product details
      "specifications": { ... },
      "images": [ ... ]
    }
  }
}
```

#### 3. Search Products
```http
GET /api/products/search?q=laptop

Response:
{
  "success": true,
  "data": {
    "products": [ ... ],
    "count": 12
  }
}
```

#### 4. Create Product (Admin)
```http
POST /api/admin/products
Authorization: Bearer <admin-token>
Content-Type: application/json

Request:
{
  "name": "MacBook Pro M3",
  "description": "Powerful laptop...",
  "shortDescription": "16GB RAM, 512GB SSD",
  "category": "category_id",
  "price": 199900,
  "discountPrice": 179900,
  "stock": 20,
  "sku": "ELEC-MBP-001",
  "mainImage": "https://...",
  "images": ["https://...", "https://..."],
  "specifications": {
    "brand": "Apple",
    "model": "MacBook Pro 14",
    "processor": "M3 Pro",
    "ram": "16GB",
    "storage": "512GB SSD"
  },
  "isFeatured": true,
  "tags": ["laptop", "apple", "macbook"]
}

Response:
{
  "success": true,
  "message": "Product created successfully",
  "data": { product }
}
```

#### 5. Update Product (Admin)
```http
PUT /api/admin/products/:id
Authorization: Bearer <admin-token>

Request: (any fields to update)
{
  "price": 189900,
  "stock": 25
}
```

#### 6. Update Stock (Admin)
```http
PATCH /api/admin/products/:id/stock
Authorization: Bearer <admin-token>

Request:
{
  "quantity": 10,
  "operation": "add" | "subtract" | "set"
}

Response:
{
  "success": true,
  "message": "Stock updated",
  "data": {
    "oldStock": 20,
    "newStock": 30
  }
}
```

#### 7. Delete Product (Admin)
```http
DELETE /api/admin/products/:id
Authorization: Bearer <admin-token>
```

---

### Cart APIs

#### 1. Get Cart
```http
GET /api/cart
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "id": "cart_item_id",
          "product": {
            "id": "...",
            "name": "MacBook Pro",
            "slug": "macbook-pro-m3",
            "mainImage": "https://...",
            "price": 179900,
            "stock": 15
          },
          "quantity": 2,
          "price": 179900,
          "subtotal": 359800,
          "addedAt": "..."
        }
      ],
      "subtotal": 359800,
      "totalItems": 2
    }
  }
}
```

#### 2. Add to Cart
```http
POST /api/cart/add
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "productId": "product_id",
  "quantity": 1
}

Response:
{
  "success": true,
  "message": "Product added to cart",
  "data": { cart }
}
```

#### 3. Update Cart Item
```http
PUT /api/cart/items/:itemId
Authorization: Bearer <token>

Request:
{
  "quantity": 3
}

Response:
{
  "success": true,
  "message": "Cart updated",
  "data": { cart }
}
```

#### 4. Remove from Cart
```http
DELETE /api/cart/items/:itemId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Item removed from cart",
  "data": { cart }
}
```

#### 5. Clear Cart
```http
DELETE /api/cart
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Cart cleared"
}
```

---

### Orders APIs

#### 1. Create Order (Checkout)
```http
POST /api/orders/checkout
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "shippingAddressId": "address_id", // or full address object
  "paymentMethod": "COD",
  "notes": "Please call before delivery"
}

Response:
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "id": "...",
      "orderNumber": "ORD-20260310-0001",
      "items": [ ... ],
      "total": 360300,
      "status": "pending"
    }
  }
}

Business Logic:
1. Validate cart not empty
2. Check stock availability for all items
3. Validate shipping address
4. Create order with snapshots
5. Reduce stock for each product
6. Clear cart
7. Send WhatsApp notification
```

#### 2. Get Order History
```http
GET /api/orders
Authorization: Bearer <token>
Query: ?page=1&limit=10&status=delivered

Response:
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "...",
        "orderNumber": "ORD-20260310-0001",
        "items": [ ... ],
        "total": 360300,
        "status": "delivered",
        "createdAt": "...",
        "deliveredAt": "..."
      }
    ],
    "pagination": { ... }
  }
}
```

#### 3. Get Single Order
```http
GET /api/orders/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "order": {
      // full order details
      "statusHistory": [
        {
          "status": "pending",
          "timestamp": "...",
          "note": "Order placed"
        },
        {
          "status": "confirmed",
          "timestamp": "...",
          "note": "Order confirmed by admin"
        }
      ]
    }
  }
}
```

#### 4. Cancel Order
```http
POST /api/orders/:id/cancel
Authorization: Bearer <token>

Request:
{
  "reason": "Changed mind"
}

Response:
{
  "success": true,
  "message": "Order cancelled successfully"
}

Business Logic:
1. Check order not already cancelled/delivered
2. Check order not shipped yet
3. Update status to cancelled
4. Restore stock for all items
5. Add to status history
6. Send WhatsApp notification
```

---

### Admin Order Management APIs

#### 1. Get All Orders (Admin)
```http
GET /api/admin/orders
Authorization: Bearer <admin-token>
Query: ?page=1&status=pending&search=ORD-001&date=2026-03-10

Response:
{
  "success": true,
  "data": {
    "orders": [ ... ],
    "stats": {
      "total": 150,
      "pending": 12,
      "confirmed": 8,
      "processing": 15,
      "shipped": 10,
      "delivered": 100,
      "cancelled": 5
    },
    "pagination": { ... }
  }
}
```

#### 2. Update Order Status (Admin)
```http
PUT /api/admin/orders/:id/status
Authorization: Bearer <admin-token>

Request:
{
  "status": "confirmed",
  "note": "Payment verified, order confirmed"
}

Response:
{
  "success": true,
  "message": "Order status updated",
  "data": { order }
}

Business Logic:
1. Validate status transition
2. Update order status
3. Add to status history
4. Send WhatsApp notification to customer
5. If status = delivered, update deliveredAt
```

#### 3. Get Order Analytics (Admin)
```http
GET /api/admin/orders/analytics
Authorization: Bearer <admin-token>
Query: ?period=week | month | year

Response:
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "totalRevenue": 2500000,
    "averageOrderValue": 16666,
    "topSellingProducts": [ ... ],
    "revenueByDay": [ ... ],
    "ordersByStatus": { ... }
  }
}
```

---

### Dashboard APIs (Admin)

#### 1. Get Dashboard Stats
```http
GET /api/admin/dashboard/stats
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "today": {
      "orders": 12,
      "revenue": 180000,
      "customers": 8
    },
    "thisMonth": {
      "orders": 150,
      "revenue": 2500000,
      "customers": 95
    },
    "overview": {
      "totalProducts": 250,
      "activeProducts": 240,
      "outOfStock": 15,
      "totalCustomers": 500,
      "totalOrders": 1500
    }
  }
}
```

---

## 🔄 Business Logic & Workflows

### Workflow 1: Customer Registration & Login
```
1. Customer enters phone number
2. System sends OTP via WhatsApp
3. Customer enters OTP
4. System verifies OTP
5. If first time: Create new user with role="customer"
6. If existing: Login user
7. Return JWT token (valid 7 days)
```

### Workflow 2: Admin Login
```
1. Admin enters email & password
2. System checks credentials (bcrypt comparison)
3. Verify role = "admin"
4. Return JWT token
```

### Workflow 3: Browse & Add to Cart
```
1. Customer browses products
2. Customer clicks "Add to Cart"
3. System checks:
   - Product exists and active
   - Stock available
   - User logged in
4. If product already in cart: increase quantity
5. If new: add to cart with current price snapshot
6. Return updated cart
```

### Workflow 4: Checkout & Place Order
```
1. Customer clicks "Checkout"
2. System validates:
   - Cart not empty
   - All products still active
   - Stock available for all items
   - Shipping address provided
3. Calculate totals:
   - Subtotal = sum of (price × quantity)
   - Shipping = ₹50 (fixed)
   - Total = Subtotal + Shipping
4. Create order with:
   - Auto-generated order number
   - Snapshot of all product details
   - Snapshot of pricing
   - Status = "pending"
5. Reduce stock for each product
6. Clear customer's cart
7. Send WhatsApp notification with order details
8. Return order confirmation
```

### Workflow 5: Order Status Update (Admin)
```
1. Admin views order
2. Admin changes status (e.g., pending → confirmed)
3. System validates status transition
4. Update order status
5. Add entry to statusHistory
6. Send WhatsApp notification to customer:

   "Your order ORD-20260310-0001 has been confirmed!

   Status: Confirmed
   Total: ₹3,60,300

   Track your order: [link]"

7. Return updated order
```

### Workflow 6: Order Cancellation
```
By Customer:
1. Customer clicks "Cancel Order"
2. System checks:
   - Order status not "shipped" or "delivered"
   - Order belongs to customer
3. Enter cancellation reason
4. Update status to "cancelled"
5. Restore stock for all items
6. Send WhatsApp notification
7. Update cancelledAt timestamp

By Admin:
1. Admin selects order
2. Admin clicks "Cancel"
3. Enter reason
4. Same process as above
```

### Workflow 7: Stock Management
```
Stock Reduction:
- Triggered when: Order status = "confirmed"
- For each item: product.stock -= quantity
- If stock becomes 0: mark as "Out of Stock"

Stock Restoration:
- Triggered when: Order cancelled
- For each item: product.stock += quantity
- Mark as "In Stock" if was out of stock
```

### Workflow 8: WhatsApp Notifications
```
Trigger Points:
1. Order Placed (pending)
2. Order Confirmed
3. Order Processing
4. Order Shipped (with tracking)
5. Order Delivered
6. Order Cancelled

Message Format:
"🛍️ Order Update

Order: ORD-20260310-0001
Status: {status}
Total: ₹{amount}

{status-specific-message}

Track: {link}"
```

---

## 📅 Development Phases

### Phase 1: Foundation ✅ (COMPLETED)
**Duration:** Already done
**Tasks:**
- ✅ Project setup
- ✅ MongoDB connection
- ✅ User model
- ✅ WhatsApp OTP auth
- ✅ JWT authentication
- ✅ Basic middleware
- ✅ Postman collection

---

### Phase 2: Admin System (NEXT)
**Duration:** 2-3 days
**Tasks:**
1. Add password field to User model
2. Admin login controller
3. Admin middleware (role check)
4. Create first admin user
5. Test admin authentication

**Deliverables:**
- Admin can login with email/password
- Admin routes protected
- Postman collection updated

---

### Phase 3: Categories
**Duration:** 1-2 days
**Tasks:**
1. Category model
2. Category CRUD controllers
3. Category routes (public + admin)
4. Slug auto-generation
5. Validation

**Deliverables:**
- Admin can manage categories
- Customers can view categories
- Tested in Postman

---

### Phase 4: Products
**Duration:** 3-4 days
**Tasks:**
1. Product model
2. Product CRUD controllers
3. Search & filter logic
4. Pagination utility
5. Stock management
6. Product routes
7. Validation

**Deliverables:**
- Admin can manage products
- Customers can browse/search products
- Stock tracking works
- Tested in Postman

---

### Phase 5: Shopping Cart
**Duration:** 2-3 days
**Tasks:**
1. Cart model
2. Cart controllers (add, update, remove, clear)
3. Cart routes
4. Stock validation
5. Price snapshot logic

**Deliverables:**
- Customers can manage cart
- Stock validation works
- Cart persists
- Tested in Postman

---

### Phase 6: Orders & Checkout
**Duration:** 4-5 days
**Tasks:**
1. Order model
2. Checkout controller
3. Order number generation
4. Stock reduction logic
5. Order history
6. Order details
7. Cancel order logic
8. Address management

**Deliverables:**
- Customers can place orders
- Stock automatically managed
- Order history viewable
- Cancellation works
- Tested in Postman

---

### Phase 7: Admin Order Management
**Duration:** 2-3 days
**Tasks:**
1. Admin order list controller
2. Order status update controller
3. Order analytics
4. Dashboard stats
5. Filters & search

**Deliverables:**
- Admin can view all orders
- Admin can update status
- Dashboard shows stats
- Tested in Postman

---

### Phase 8: WhatsApp Notifications
**Duration:** 2-3 days
**Tasks:**
1. WhatsApp message templates
2. WhatsApp send helpers using the existing provider
3. Integrate with order flow
4. Test all notification triggers

**Deliverables:**
- Customers get WhatsApp updates
- All status changes notify
- Templates formatted nicely

---

### Phase 9: Testing & Refinement
**Duration:** 3-4 days
**Tasks:**
1. End-to-end testing
2. Error handling improvements
3. Validation improvements
4. Performance optimization
5. Security audit
6. Documentation update

**Deliverables:**
- All features tested
- Bug-free system
- Production-ready

---

### Phase 10: Future Enhancements
**Later:**
- Image upload (Cloudinary)
- Reviews & ratings
- Coupons/discounts
- Payment gateway (Razorpay)
- Email notifications
- Meta WhatsApp Business API migration

---

## 🧪 Testing Strategy

### Unit Testing
- Test each controller function
- Test utility functions
- Test middleware

### Integration Testing
- Test complete user flows
- Test API endpoints
- Test database operations

### Postman Testing
- Create test cases for each endpoint
- Test success scenarios
- Test error scenarios
- Test edge cases

### Manual Testing Checklist

**Authentication:**
- [ ] Send OTP to valid number
- [ ] Send OTP to invalid number
- [ ] Verify with correct OTP
- [ ] Verify with wrong OTP
- [ ] Verify after expiry
- [ ] Max attempts exceeded
- [ ] Admin login successful
- [ ] Admin login with wrong password

**Products:**
- [ ] Browse products
- [ ] Search products
- [ ] Filter by category
- [ ] Filter by price
- [ ] View product details
- [ ] Out of stock products
- [ ] Admin create product
- [ ] Admin update product
- [ ] Admin delete product

**Cart:**
- [ ] Add product to cart
- [ ] Add same product again (quantity increase)
- [ ] Update quantity
- [ ] Remove item
- [ ] Clear cart
- [ ] Add out of stock product (should fail)

**Orders:**
- [ ] Place order with valid cart
- [ ] Place order with empty cart (should fail)
- [ ] Place order with out of stock item (should fail)
- [ ] View order history
- [ ] View order details
- [ ] Cancel order (before shipping)
- [ ] Cancel order after shipping (should fail)
- [ ] Stock reduced after order
- [ ] Stock restored after cancellation

**Admin:**
- [ ] View all orders
- [ ] Filter orders by status
- [ ] Update order status
- [ ] View dashboard stats
- [ ] View analytics

---

## 📝 Notes & Conventions

### Naming Conventions
- **Models:** PascalCase (User, Product, Order)
- **Variables:** camelCase (userId, orderNumber)
- **Files:** kebab-case (user.controller.js)
- **Routes:** kebab-case (/api/auth/send-otp)
- **Database fields:** camelCase (createdAt, isActive)

### Response Format
```javascript
// Success
{
  success: true,
  message: "...",  // optional
  data: { ... }     // actual data
}

// Error
{
  success: false,
  message: "Error description",
  error: "..."      // detailed error (development only)
}
```

### HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (auth required)
- 403: Forbidden (no permission)
- 404: Not Found
- 409: Conflict (duplicate)
- 500: Server Error

### Environment Variables
```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ecommerce

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# WhatsApp
GREEN_API_INSTANCE_ID=7103541630
GREEN_API_TOKEN=590a2bbb7aa04ac7ac65ed969d1d81774853756022e641b788
WHATSAPP_PROVIDER=greenapi

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password-here

# Business
SHIPPING_CHARGES=50
CURRENCY=INR
```

---

## 🎯 Success Criteria

### Must Have
- ✅ WhatsApp OTP login
- ✅ Product browsing
- ✅ Shopping cart
- ✅ Order placement
- ✅ COD payment
- ✅ Order tracking
- ✅ Admin management
- ✅ WhatsApp notifications
- ✅ Stock management

### Nice to Have (Later)
- Reviews & ratings
- Coupons
- Payment gateway
- Image uploads
- Email notifications
- Advanced analytics
- Meta WhatsApp API

---

## 📞 Support & Maintenance

### Monitoring
- Log all errors
- Track API response times
- Monitor database performance
- Track failed notifications

### Backup Strategy
- Daily database backups
- Store order data securely
- Backup user information

### Security
- JWT token expiry
- Password hashing (bcrypt)
- Input validation
- SQL injection prevention (Mongoose)
- Rate limiting
- HTTPS only (production)

---

**Last Updated:** March 10, 2026
**Version:** 1.0
**Status:** Planning Complete ✅
