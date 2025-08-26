// import mongoose from 'mongoose';
// import { logger } from './logger.service';
// import { MONGODB_URI } from '../config/config';

// export async function connectDB() {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     logger.info('Connected to MongoDB');
//     return mongoose.connection;
//   } catch (err:any) {
//     logger.error(`MongoDB connection error: ${err.message}`);
//     throw err;
//   }
// }
// db.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({datasources: {
    db: {
      url: "afalagi-bot-db.cgt846uc8bpa.us-east-1.rds.amazonaws.com"
    }
  }});

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL via Prisma");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1);
  }
};

export default prisma;
