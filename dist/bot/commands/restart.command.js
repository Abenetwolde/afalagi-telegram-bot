"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restartCommand = restartCommand;
async function restartCommand(ctx) {
  ctx.session = {};
  await ctx.reply("Starting a new submission.");
  await ctx.scene.enter("questionnaire");
}
