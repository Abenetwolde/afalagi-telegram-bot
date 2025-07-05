import { Context, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { User } from '../models/user.model';
import { IBotContext } from '../../types';
import { SceneContextScene } from 'telegraf/typings/scenes';

export async function reviewCommand(ctx: any & any & { scene:any }) {
  const user = await User.findOne({ telegramId: ctx.from!.id });
  if (!user?.lastSubmissionId) {
    await ctx.reply('No previous submission found. Start a new one with /start.');
    return;
  }
  const submission = await Submission.findById(user.lastSubmissionId).populate('answers.questionId');
  if (submission) {
    await ctx.reply(
      'Your previous answers:\n' +
      submission.answers
        .filter(a => !(a.questionId as any).confidential)
        .map(a => `${(a.questionId as any).text}: ${a.answer}`)
        .join('\n'),
      Markup.inlineKeyboard([
        Markup.button.callback('Edit', 'edit'),
        Markup.button.callback('Submit', 'submit'),
      ])
    );
    ctx.session.answers = submission.answers;
    await ctx.scene.enter('questionnaire', { step: 3 }); // Jump to edit/submit step
  }
}