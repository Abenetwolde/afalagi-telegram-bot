import { Telegraf, session, Context, Markup } from 'telegraf';
import 'dotenv/config';
import { Stage } from 'telegraf/scenes';
import { questionnaireScene } from './scenes/questionnaire.scene';
import { startCommand } from './commands/start.command';
import { rateLimitMiddleware } from './middleware/raterate-limit.middleware';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware';
import prisma, { connectDB } from './services/database.service';

import { logger } from './services/logger.service';
import { BOT_TOKEN, ADMIN_IDS } from './config/config';
import { reviewCommand } from './commands/review.command';
import { restartCommand } from './commands/restart.command';
import { cancelCommand } from './commands/cancel.command';
import { userScene } from './scenes/userScene';
import { adminScene } from './scenes/admin.scene';
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());
// bot.use(rateLimitMiddleware);
// bot.use(errorHandlerMiddleware);
async function handleStartOrCancel(ctx: any) {
  const isCancel = /cancel/i.test(ctx.message?.text || ctx.update?.message?.text || ctx.updateType === 'callback_query' && ctx.update?.callback_query?.data === 'cancel');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  } 
  if (isCancel) {  
    console.log('Global start/cancel: cancel triggered');
    await cancelCommand(ctx);
  } else {
    console.log('Global start/cancel: start triggered');
    await ctx.reply(
      'Welcome! Please fill out the form to continue.',
      { 
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback('Apply', 'apply_to_questionnaire'),
        ]).reply_markup,
      }
    );
    await ctx.reply(
      'Choose an option:',
      Markup.keyboard([
        ['Application 📝', 'My Applications 📋'],
      ])
        .oneTime()
        .resize()
    );
  }
}
const stage = new Stage([questionnaireScene, userScene,adminScene]);
// Remove individual stage.command and stage.hears for start/cancel
stage.command(['start', 'cancel'], handleStartOrCancel);
stage.hears(/^(start|cancel)$/i, handleStartOrCancel);

// Handle inline Apply button
stage.action('apply_to_questionnaire', async (ctx: any) => {
  console.log('Inline button: Apply triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await ctx.scene.enter('questionnaire');
});

// Handle keyboard selections
stage.hears('Application 📝', async (ctx: any) => {
  console.log('Keyboard: Application selected');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await ctx.scene.enter('questionnaire');
});

stage.hears('My Applications 📋', async (ctx: any) => {
  console.log('Keyboard: My Applications selected');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }

  await ctx.scene.enter('user');
});

// Apply middleware
bot.use(stage);

// Existing commands
bot.command('form', async (ctx: any) => {
  console.log('Global /form command triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await startCommand(ctx);
});

bot.command('myapplications', async (ctx: any) => {
  console.log('Global /myapplications command triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await ctx.scene.enter('user');
});

bot.command('restart', async (ctx: any) => {
  console.log('Global /restart command triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await restartCommand(ctx);
});

bot.command('review', async (ctx: any) => {
  console.log('Global /review command triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await reviewCommand(ctx);
});
bot.command('admin', async (ctx: any) => {
  console.log('Global /review command triggered');
  if (ctx.scene.current) {
    console.log(`Exiting current scene: ${ctx.scene.current.id}`);
    await ctx.scene.leave();
  }
  await ctx.scene.enter('admin');
});


bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot and show main menu' },
  { command: 'cancel', description: 'Cancel current operation' },
  { command: 'form', description: 'Fill out a new application form' },
  { command: 'myapplications', description: 'View your applications' },
  { command: 'restart', description: 'Restart your session' },
  { command: 'review', description: 'Review applications (admin only)' },
    { command: 'admin', description: ' (admin only)' },
]);
async function startBot() {
  try {
    await connectDB();
    await bot.launch({
      webhook: {
        domain: `ec2-54-211-12-104.compute-1.amazonaws.com`,
        port: 3000, // Changed to 3000
      }
    });
    console.log("Bot started with webhook");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

startBot();

// startBot();
// Start bot
// bot.launch().then(() => {
//   logger.info('Bot started');
//   // connectDB();
// });
// It receives a request from API Gateway and handles it.
// export const handler = async (event: any, context: any) => {
//   try {
//     // Telegraf expects the body to be a JSON object, so we parse it
//     const update = JSON.parse(event.body);
    
//     // Connect to the database before processing the update
//     await connectDB();

//     // Telegraf handles the update and executes the appropriate bot logic
//     await bot.handleUpdate(update);

//     // Return a success response to API Gateway
//     return {
//       statusCode: 200,
//       body: JSON.stringify({ message: 'Update handled successfully' }),
//     };

//   } catch (error) {
//     console.error('Error handling update:', error);
//     // Return an error response if something goes wrong
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: 'Internal Server Error' }),
//     };
//   } finally {
//     // Ensure the database connection is closed after each invocation
//     await prisma.$disconnect();
//   }
// };
// Handle graceful shutdown
process.on('SIGINT', () => {
  bot.stop('SIGINT');
  logger.info('Bot stopped');
});