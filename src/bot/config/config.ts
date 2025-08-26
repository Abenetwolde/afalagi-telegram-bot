export const BOT_TOKEN = process.env.BOT_TOKEN || "7759489573:AAFwLVA6e04eL7MZw4CJqkVL2pWbV2Lsmck";
export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/tdarafalagi";
export const WEB_PORT = process.env.WEB_PORT || 3000;
export const CHANNEL_ID = process.env.CHANNEL_ID || "";
export const ADMIN_IDS = process.env.ADMIN_IDS?.split(",").map(Number) || [];
