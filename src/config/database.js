const mongoose = require('mongoose');

const seedAdmin = async () => {
  try {
    const User = require('../models/User');
    const existing = await User.findOne({ role: 'admin' });
    if (!existing) {
      await User.create({
        phone: '+910000000000',
        name: 'Rushi',
        email: 'rushi@eccom.com',
        role: 'admin',
        password: 'eccom@123',
        isVerified: true,
        isActive: true,
      });
      console.log('✅ Admin user created: rushi@eccom.com');
    }
  } catch (err) {
    console.error('Admin seed error:', err.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedAdmin();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
