"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_IDS = exports.CHANNEL_ID = exports.WEB_PORT = exports.MONGODB_URI = exports.BOT_TOKEN = void 0;
exports.BOT_TOKEN = process.env.BOT_TOKEN || '';
exports.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tdarafalagi';
exports.WEB_PORT = process.env.WEB_PORT || 3000;
exports.CHANNEL_ID = process.env.CHANNEL_ID || '';
exports.ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(Number) || [];
