export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-bot';
export const WEB_PORT = process.env.WEB_PORT || 3000;
export const CHANNEL_ID = process.env.CHANNEL_ID || '';
export const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(Number) || [];