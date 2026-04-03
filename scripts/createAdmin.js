require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

/**
 * Script to create first admin user
 * Usage: node scripts/createAdmin.js
 */

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
    } catch (error) {
      const isSrvFailure = error.message.toLowerCase().includes('querysrv');
      if (!isSrvFailure || !process.env.MONGODB_DIRECT_URI) {
        throw error;
      }

      await mongoose.connect(process.env.MONGODB_DIRECT_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
    }
    console.log('✅ MongoDB Connected');

    // Admin credentials
    // Phone is kept as contact metadata, email is used for login
    const adminData = {
      phone: '+910000000000',
      name: 'Rushi',
      email: 'rushi@eccom.com',
      role: 'admin',
      password: 'eccom@123', // Will be hashed automatically
      isVerified: true,
      isActive: true,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('\nAdmin Credentials:');
      console.log(`Email: ${existingAdmin.email || 'No email set on existing admin account'}`);
      console.log(`Phone: ${existingAdmin.phone || 'No phone set on existing admin account'}`);
      console.log('Password: Existing password unchanged');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create(adminData);

    console.log('\n✅ Admin user created successfully!');
    console.log('\n📋 Admin Details:');
    console.log(`ID: ${admin._id}`);
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log('\n🔐 Admin Credentials:');
    console.log(`Email: ${admin.email}`);
    console.log('Password: eccom@123');
    console.log(`Phone: ${admin.phone}`);
    console.log('\n⚠️  Please change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
