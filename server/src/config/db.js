import mongoose from 'mongoose';
import logger from './logger.js';

let isConnected = false;

export async function connectDB(customUri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_mailer';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    logger.info(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error({ err: error.message }, '[MongoDB] Connection failed');
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('[MongoDB] Disconnected successfully');
  }
}

export default connectDB;
