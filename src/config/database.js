const mongoose = require('mongoose');

const RETRY_INTERVAL_MS = 5000;

const sanitizeMongoUri = (uri = '') => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:<redacted>@');

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
      console.log('✅ Admin user created: rushi@eccom.com / eccom@123');
    }
  } catch (err) {
    console.error('Admin seed error:', err.message);
  }
};

const tryConnect = async (uri) => {
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  await seedAdmin();
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const directUri = process.env.MONGODB_DIRECT_URI;

  const attempt = async () => {
    // Try SRV URI first, fall back to direct URI if SRV lookup fails
    try {
      await tryConnect(mongoUri);
    } catch (srvError) {
      const isSrvFail = srvError.message.toLowerCase().includes('querysrv');

      if (isSrvFail && directUri) {
        console.warn('⚠️  SRV lookup failed (router DNS issue), trying direct URI...');
        try {
          await tryConnect(directUri);
          return;
        } catch (directError) {
          console.error(`❌ Direct connection also failed: ${directError.message}`);
        }
      } else {
        console.error(`❌ MongoDB connection failed: ${srvError.message}`);
        if (srvError.message.toLowerCase().includes('auth')) {
          console.error('   → Wrong username or password in MONGODB_URI.');
        }
      }

      console.log(`   ⏳ Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      setTimeout(attempt, RETRY_INTERVAL_MS);
    }
  };

  await attempt();
};

module.exports = connectDB;
