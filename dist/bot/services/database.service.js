"use strict";
// import mongoose from 'mongoose';
// import { logger } from './logger.service';
// import { MONGODB_URI } from '../config/config';
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
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
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL via Prisma");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1);
  }
};
exports.connectDB = connectDB;
exports.default = prisma;
