import { Context } from 'telegraf';
import { IBotContext } from '../../types';

export async function startCommand(ctx:any) {
  await ctx.reply(
    'Welcome to the submission bot! Please answer the questions to complete your profile.\n' +
    'Use /cancel to stop or /restart to start over.'
  );
  await ctx.scene.enter('questionnaire');
}