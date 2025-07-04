import { Scenes, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { Reputation } from '../models/reputation.model';
// import { scheduler } from '../services/scheduler.service';
import { logger } from '../services/logger.service';
import { IBotContext } from '../../types';
import { CHANNEL_ID,ADMIN_IDS } from '../config/config';

export const adminScene = new Scenes.BaseScene<IBotContext>('admin');

adminScene.enter(async (ctx) => {
  if (!ctx.from || !ADMIN_IDS.includes(ctx.from.id)) {
    await ctx.reply('Unauthorized');
    return ctx.scene.leave();
  }
  const submissions = await Submission.find({ status: 'pending' });
  if (submissions.length === 0) {
    await ctx.reply('No pending submissions');
    return;
  }
  for (const submission of submissions) {
    await ctx.reply(
      `Submission from ${submission.userId}:\n` +
      Object.entries(submission.answers)
        .map(([key, value]) => `${key}: ${value}`).join('\n'),
      Markup.inlineKeyboard([
        Markup.button.callback('Approve', `approve_${submission._id}`),
        Markup.button.callback('Reject', `reject_${submission._id}`),
        Markup.button.callback('Schedule', `schedule_${submission._id}`),
      ])
    );
  }
});

adminScene.action(/approve_(.+)/, async (ctx) => {
  const submissionId = ctx.match[1];
  const submission = await Submission.findById(submissionId);
  if (submission) {
    submission.status = 'approved';
    await submission.save();
    const reputation = await Reputation.findOneAndUpdate(
      { userId: submission.userId },
      { $inc: { score: 1 } },
      { upsert: true, new: true }
    );
    if (reputation.score >= 5) {
      // Auto-approve for high reputation
      await ctx.telegram.sendMessage(
        CHANNEL_ID,
        Object.entries(submission.answers)
          .filter(([key]) => !questions.find(q => q.key === key)?.confidential)
          .map(([key, value]) => `${key}: ${value}`).join('\n')
      );
    }
    await ctx.reply('Submission approved');
    await ctx.telegram.sendMessage(submission.userId, 'Your submission was approved!');
  }
});

adminScene.action(/reject_(.+)/, async (ctx) => {
  const submissionId = ctx.match[1];
  const submission = await Submission.findById(submissionId);
  if (submission) {
    submission.status = 'rejected';
    await submission.save();
    await ctx.reply('Submission rejected');
    await ctx.telegram.sendMessage(submission.userId, 'Your submission was rejected.');
  }
});

adminScene.action(/schedule_(.+)/, async (ctx) => {
  const submissionId = ctx.match[1];
  await ctx.reply('Enter schedule time (YYYY-MM-DD HH:mm)');
  ctx.scene.state.schedulingSubmissionId = submissionId;
});

adminScene.hears(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/, async (ctx) => {
  const submissionId = ctx.scene.state.schedulingSubmissionId;
  const submission = await Submission.findById(submissionId);
  if (submission) {
    scheduler.scheduleJob(new Date(ctx.message!.text), async () => {
      await ctx.telegram.sendMessage(
        CHANNEL_ID,
        Object.entries(submission.answers)
          .filter(([key]) => !questions.find(q => q.key === key)?.confidential)
          .map(([key, value]) => `${key}: ${value}`).join('\n')
      );
      submission.status = 'approved';
      await submission.save();
    });
    await ctx.reply('Submission scheduled');
  }
});