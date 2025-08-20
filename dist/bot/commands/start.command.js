"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCommand = startCommand;
async function startCommand(ctx) {
    await ctx.reply('Welcome to the submission bot! Please answer the questions to complete your profile.\n' +
        'Use /cancel to stop or /restart to start over.');
    await ctx.scene.enter('questionnaire');
}
