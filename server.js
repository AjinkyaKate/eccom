require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');

// Initialize app
const app = express();

// Connect to MongoDB
connectDB();

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/admin/products', require('./src/routes/admin.product.routes'));
app.use('/api/admin/orders', require('./src/routes/admin.order.routes'));
app.use('/api/admin/dashboard', require('./src/routes/admin.dashboard.routes'));
app.use('/api/admin/settings', require('./src/routes/admin.settings.routes'));
app.use('/api/categories', require('./src/routes/category.routes'));
app.use('/api/products', require('./src/routes/product.routes'));
app.use('/api/cart', require('./src/routes/cart.routes'));
app.use('/api/orders', require('./src/routes/order.routes'));
app.use('/api/addresses', require('./src/routes/address.routes'));
app.use('/api/admin/upload', require('./src/routes/upload.routes'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Available Routes:`);
  console.log(`\n   Customer Auth:`);
  console.log(`   POST /api/auth/send-otp - Send OTP to WhatsApp`);
  console.log(`   POST /api/auth/verify-otp - Verify OTP and login`);
  console.log(`   GET  /api/auth/me - Get current user (protected)`);
  console.log(`\n   Admin:`);
  console.log(`   POST /api/admin/login - Admin login`);
  console.log(`   GET  /api/admin/me - Get admin profile (admin)`);
  console.log(`   GET  /api/admin/products - List products (admin)`);
  console.log(`   POST /api/admin/products - Create product (admin)`);
  console.log(`   PUT  /api/admin/products/:id - Update product (admin)`);
  console.log(`   PATCH /api/admin/products/:id/stock - Update stock (admin)`);
  console.log(`   DELETE /api/admin/products/:id - Delete product (admin)`);
  console.log(`   GET  /api/admin/orders - List orders (admin)`);
  console.log(`   GET  /api/admin/orders/:id - Get order details (admin)`);
  console.log(`   PUT  /api/admin/orders/:id/status - Update order status (admin)`);
  console.log(`   PUT  /api/admin/orders/:id/payment - Update payment status (admin)`);
  console.log(`   GET  /api/admin/dashboard/stats - Dashboard stats (admin)`);
  console.log(`\n   Categories:`);
  console.log(`   GET    /api/categories - List all categories (public)`);
  console.log(`   GET    /api/categories/:slug - Get category (public)`);
  console.log(`   POST   /api/categories - Create category (admin)`);
  console.log(`   PUT    /api/categories/:id - Update category (admin)`);
  console.log(`   DELETE /api/categories/:id - Delete category (admin)`);
  console.log(`\n   Products:`);
  console.log(`   GET    /api/products - List products (public)`);
  console.log(`   GET    /api/products/search?q=term - Search products (public)`);
  console.log(`   GET    /api/products/:slug - Get product details (public)\n`);
  console.log(`   Cart:`);
  console.log(`   GET    /api/cart - Get cart (protected)`);
  console.log(`   POST   /api/cart/add - Add item to cart (protected)`);
  console.log(`   PUT    /api/cart/items/:itemId - Update cart item (protected)`);
  console.log(`   DELETE /api/cart/items/:itemId - Remove cart item (protected)`);
  console.log(`   DELETE /api/cart - Clear cart (protected)`);
  console.log(`\n   Orders:`);
  console.log(`   GET    /api/orders/checkout/summary - Checkout summary (protected)`);
  console.log(`   POST   /api/orders/checkout - Place order (protected)`);
  console.log(`   GET    /api/orders - Get customer orders (protected)`);
  console.log(`   GET    /api/orders/:id - Get customer order detail (protected)`);
  console.log(`   POST   /api/orders/:id/cancel - Cancel customer order (protected)\n`);
  console.log(`   Addresses:`);
  console.log(`   GET    /api/addresses - List saved addresses (protected)`);
  console.log(`   POST   /api/addresses - Add new address (protected)`);
  console.log(`   PUT    /api/addresses/:id - Update address (protected)`);
  console.log(`   DELETE /api/addresses/:id - Delete address (protected)`);
  console.log(`   PATCH  /api/addresses/:id/default - Set default address (protected)\n`);
});
