import { startCommand } from "../commands/start.command";
// ...existing imports...

function globalCommandMiddleware(step: any) {
  return async (ctx: any) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === "/start") {
      await ctx.scene.leave();
      await startCommand(ctx);
      return;
    }
    return step(ctx);
  };
}
export { globalCommandMiddleware };
