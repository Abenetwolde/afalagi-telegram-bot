"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelCommand = cancelCommand;
async function cancelCommand(ctx) {
  await ctx.reply("Submission cancelled.");
  await ctx.scene.leave();
}
