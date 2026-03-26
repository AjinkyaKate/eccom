const mongoose = require('mongoose');

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

const sanitizeMongoUri = (uri = '') => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:<redacted>@');
const isSrvLookupError = (errorMessage = '') => errorMessage.toLowerCase().includes('querysrv');

const getMongoHint = (errorMessage = '') => {
  const message = errorMessage.toLowerCase();

  if (message.includes('querysrv econnrefused') || message.includes('querysrv enotfound')) {
    return 'Check that the Atlas cluster host is correct and the cluster is still active.';
  }

  if (message.includes('authentication failed') || message.includes('bad auth')) {
    return 'The database username or password is incorrect, or the DB user does not have access.';
  }

  if (message.includes('ip') || message.includes('whitelist') || message.includes('not authorized')) {
    return 'Atlas Network Access may be blocking this machine.';
  }

  if (message.includes('timed out') || message.includes('server selection')) {
    return 'The cluster may be paused, unreachable, or blocked by Atlas Network Access rules.';
  }

  return 'Verify the Atlas cluster is active, the DB user credentials are correct, and Atlas Network Access allows this machine.';
};

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
  const mongoUri = process.env.MONGODB_URI;
  const directMongoUri = process.env.MONGODB_DIRECT_URI;

  if (!mongoUri) {
    console.error('MongoDB Connection Error: MONGODB_URI is not set');
    process.exit(1);
  }

  const connectOptions = {
    serverSelectionTimeoutMS:
      parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 10) || DEFAULT_CONNECT_TIMEOUT_MS,
  };

  const urisToTry = [mongoUri];

  if (directMongoUri) {
    urisToTry.push(directMongoUri);
  }

  for (let index = 0; index < urisToTry.length; index += 1) {
    const uri = urisToTry[index];

    try {
      const conn = await mongoose.connect(uri, connectOptions);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      await seedAdmin();
      return;
    } catch (error) {
      const hasFallback = Boolean(directMongoUri);
      const shouldTryFallback = index === 0 && hasFallback && isSrvLookupError(error.message);

      console.error(`MongoDB URI: ${sanitizeMongoUri(uri)}`);
      console.error(`MongoDB Connection Error: ${error.message}`);

      if (shouldTryFallback) {
        console.error('MongoDB Fallback: Retrying with MONGODB_DIRECT_URI because the SRV lookup failed.');
        continue;
      }

      console.error(`MongoDB Hint: ${getMongoHint(error.message)}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
