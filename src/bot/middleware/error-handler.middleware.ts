import { Context } from "telegraf";
import { logger } from "../services/logger.service";

export async function errorHandlerMiddleware(ctx: Context, next: any) {
  try {
    await next();
  } catch (err: any) {
    logger.error(`Error: ${err.message}`);
    await ctx.reply("Something went wrong. Please try again later.");
  }
}
