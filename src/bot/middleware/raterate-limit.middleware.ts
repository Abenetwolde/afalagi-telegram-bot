import { Context } from "telegraf";
import { RateLimiterMongo } from "rate-limiter-flexible";
import { connectDB } from "../services/database.service";
import { logger } from "../services/logger.service";

const rateLimiter = new RateLimiterMongo({
  storeClient: connectDB(),
  points: 100,
  duration: 24 * 60 * 60, // 1 submission per day
});

export async function rateLimitMiddleware(ctx: Context, next: any) {
  try {
    await rateLimiter.consume(ctx.from!.id.toString());
    await next();
  } catch (err) {
    await ctx.reply(
      "You can only submit once per day. Please try again later.",
    );
    logger.warn(`Rate limit exceeded for user ${ctx.from!.id}`);
  }
}
