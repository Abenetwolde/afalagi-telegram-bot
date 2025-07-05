import { Telegraf, session } from 'telegraf';
import 'dotenv/config';
import { Stage } from 'telegraf/scenes';
import { questionnaireScene } from './scenes/questionnaire.scene';
// import { adminScene } from './scenes/admin.scene';
import { startCommand } from './commands/start.command';
// import { cancelCommand } from './commands/cancel.command';
// import { restartCommand } from './commands/restart.command';
// import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { rateLimitMiddleware } from './middleware/raterate-limit.middleware';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware';
import { connectDB } from './services/database.service';
import { logger } from './services/logger.service';
import { BOT_TOKEN, ADMIN_IDS } from './config/config';
import { reviewCommand } from './commands/review.command';
import { restartCommand } from './commands/restart.command';
import { cancelCommand } from './commands/cancel.command';

const bot = new Telegraf(BOT_TOKEN);

const stage = new Stage([questionnaireScene]);
bot.use(session());
bot.use(rateLimitMiddleware);
bot.use(errorHandlerMiddleware);
bot.use(stage.middleware());
// bot.use(async (ctx, next) => {
//   if (ctx.text && ctx.text && ctx.text?.startsWith('/start')) {
//     await startCommand(ctx);
//     // Optionally, return here if you don't want other middlewares/handlers to run
//     return;
//   }
//   await next();
// });
bot.command('start', startCommand);
bot.command('cancel', cancelCommand);
bot.command('restart', restartCommand);
bot.command('review', reviewCommand)

bot.launch().then(() => {
  logger.info('Bot started');
  connectDB();
});

process.on('SIGINT', () => {
  bot.stop('SIGINT');
  logger.info('Bot stopped');
});