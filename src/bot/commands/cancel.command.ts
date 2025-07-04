import { Context } from 'telegraf';
import { IBotContext } from '../../types';

export async function cancelCommand(ctx: Context & IBotContext) {
  await ctx.reply('Submission cancelled.');
  await ctx.scene.leave();
}