import { Context } from 'telegraf';
import { IBotContext } from '../../types';

export async function restartCommand(ctx: Context & IBotContext) {
  ctx.session = {};
  await ctx.reply('Starting a new submission.');
  await ctx.scene.enter('questionnaire');
}