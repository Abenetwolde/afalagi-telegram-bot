"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const telegraf_1 = require("telegraf");
require("dotenv/config");
const scenes_1 = require("telegraf/scenes");
const questionnaire_scene_1 = require("./scenes/questionnaire.scene");
const start_command_1 = require("./commands/start.command");
const database_service_1 = require("./services/database.service");
const logger_service_1 = require("./services/logger.service");
const config_1 = require("./config/config");
const review_command_1 = require("./commands/review.command");
const restart_command_1 = require("./commands/restart.command");
const cancel_command_1 = require("./commands/cancel.command");
const userScene_1 = require("./scenes/userScene");
const admin_scene_1 = require("./scenes/admin.scene");
const bot = new telegraf_1.Telegraf(config_1.BOT_TOKEN);
bot.use((0, telegraf_1.session)());
// bot.use(rateLimitMiddleware);
// bot.use(errorHandlerMiddleware);
async function handleStartOrCancel(ctx) {
    const isCancel = /cancel/i.test(ctx.message?.text || ctx.update?.message?.text || ctx.updateType === 'callback_query' && ctx.update?.callback_query?.data === 'cancel');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    if (isCancel) {
        console.log('Global start/cancel: cancel triggered');
        await (0, cancel_command_1.cancelCommand)(ctx);
    }
    else {
        console.log('Global start/cancel: start triggered');
        await ctx.reply('Welcome! Please fill out the form to continue.', {
            reply_markup: telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.callback('Apply', 'apply_to_questionnaire'),
            ]).reply_markup,
        });
        await ctx.reply('Choose an option:', telegraf_1.Markup.keyboard([
            ['Application 📝', 'My Applications 📋'],
        ])
            .oneTime()
            .resize());
    }
}
const stage = new scenes_1.Stage([questionnaire_scene_1.questionnaireScene, userScene_1.userScene, admin_scene_1.adminScene]);
// Remove individual stage.command and stage.hears for start/cancel
stage.command(['start', 'cancel'], handleStartOrCancel);
stage.hears(/^(start|cancel)$/i, handleStartOrCancel);
// Handle inline Apply button
stage.action('apply_to_questionnaire', async (ctx) => {
    console.log('Inline button: Apply triggered');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await ctx.scene.enter('questionnaire');
});
// Handle keyboard selections
stage.hears('Application 📝', async (ctx) => {
    console.log('Keyboard: Application selected');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await ctx.scene.enter('questionnaire');
});
stage.hears('My Applications 📋', async (ctx) => {
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
bot.command('form', async (ctx) => {
    console.log('Global /form command triggered');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await (0, start_command_1.startCommand)(ctx);
});
bot.command('myapplications', async (ctx) => {
    console.log('Global /myapplications command triggered');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await ctx.scene.enter('user');
});
bot.command('restart', async (ctx) => {
    console.log('Global /restart command triggered');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await (0, restart_command_1.restartCommand)(ctx);
});
bot.command('review', async (ctx) => {
    console.log('Global /review command triggered');
    if (ctx.scene.current) {
        console.log(`Exiting current scene: ${ctx.scene.current.id}`);
        await ctx.scene.leave();
    }
    await (0, review_command_1.reviewCommand)(ctx);
});
bot.command('admin', async (ctx) => {
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
// Start bot
// bot.launch().then(() => {
//   logger.info('Bot started');
//   connectDB();
// });
// It receives a request from API Gateway and handles it.
const handler = async (event, context) => {
    try {
        // Telegraf expects the body to be a JSON object, so we parse it
        const update = JSON.parse(event.body);
        // Connect to the database before processing the update
        await (0, database_service_1.connectDB)();
        // Telegraf handles the update and executes the appropriate bot logic
        await bot.handleUpdate(update);
        // Return a success response to API Gateway
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Update handled successfully' }),
        };
    }
    catch (error) {
        console.error('Error handling update:', error);
        // Return an error response if something goes wrong
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
    finally {
        // Ensure the database connection is closed after each invocation
        await prisma.$disconnect();
    }
};
exports.handler = handler;
// Handle graceful shutdown
process.on('SIGINT', () => {
    bot.stop('SIGINT');
    logger_service_1.logger.info('Bot stopped');
});
