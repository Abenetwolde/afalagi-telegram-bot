import mongoose from 'mongoose';
import { logger } from './logger.service';
import { MONGODB_URI } from '../config/config';

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
    return mongoose.connection;
  } catch (err:any) {
    logger.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }
}