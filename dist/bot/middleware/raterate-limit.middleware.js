"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const database_service_1 = require("../services/database.service");
const logger_service_1 = require("../services/logger.service");
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMongo({
  storeClient: (0, database_service_1.connectDB)(),
  points: 100,
  duration: 24 * 60 * 60, // 1 submission per day
});
async function rateLimitMiddleware(ctx, next) {
  try {
    await rateLimiter.consume(ctx.from.id.toString());
    await next();
  } catch (err) {
    await ctx.reply(
      "You can only submit once per day. Please try again later.",
    );
    logger_service_1.logger.warn(`Rate limit exceeded for user ${ctx.from.id}`);
  }
}
