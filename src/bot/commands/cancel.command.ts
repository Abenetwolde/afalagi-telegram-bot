import { Context } from 'telegraf';
import { IBotContext } from '../../types';

export async function cancelCommand(ctx:any) {
  await ctx.reply('Submission cancelled.');
  await ctx.scene.leave();
}