"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCommandMiddleware = globalCommandMiddleware;
const start_command_1 = require("../commands/start.command");
// ...existing imports...
function globalCommandMiddleware(step) {
    return async (ctx) => {
        if (ctx.message && 'text' in ctx.message && ctx.message.text === '/start') {
            await ctx.scene.leave();
            await (0, start_command_1.startCommand)(ctx);
            return;
        }
        return step(ctx);
    };
}
