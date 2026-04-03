require('dotenv').config();
const mongoose = require('mongoose');

const connectWithFallback = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const directUri = process.env.MONGODB_DIRECT_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    return;
  } catch (error) {
    const isSrvFailure = error.message.toLowerCase().includes('querysrv');
    if (!isSrvFailure || !directUri) {
      throw error;
    }
  }

  await mongoose.connect(process.env.MONGODB_DIRECT_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
};

const clearData = async () => {
  try {
    await connectWithFallback();

    const { collections } = mongoose.connection;
    const collectionNames = Object.keys(collections);

    if (collectionNames.length === 0) {
      console.log('No collections found. Database is already empty.');
      process.exit(0);
    }

    for (const name of collectionNames) {
      const result = await collections[name].deleteMany({});
      console.log(`${name}: deleted ${result.deletedCount} documents`);
    }

    console.log('All project data cleared.');
    process.exit(0);
  } catch (error) {
    console.error('Clear data error:', error.message);
    process.exit(1);
  }
};

clearData();
