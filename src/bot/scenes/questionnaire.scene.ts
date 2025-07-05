import { Scenes, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { User } from '../models/user.model';
import { Question } from '../models/question.model';
import { logger } from '../services/logger.service';


export const questionnaireScene = new Scenes.WizardScene<
  any
>(
  'questionnaire',
  async (ctx) => {

    // Check for previous submission
    const user = await User.findOne({ telegramId: ctx.from!.id });
    ctx.wizard.state.questions = await Question.find()/* .sort({ category: 1 }); */

    ctx.wizard.state.answers = ctx.wizard.state.answers || [];
    
    if (user?.lastSubmissionId) {
      console.log('User has a last submission ID:', user.lastSubmissionId);
      const lastSubmission = await Submission.findById(user.lastSubmissionId).populate('answers.questionId');
      if (lastSubmission) {
        await ctx.reply(
          'You have a previous submission. Would you like to review/edit it or start a new one?',
          Markup.inlineKeyboard([
            Markup.button.callback('Review/Edit', 'review'),
            Markup.button.callback('Start New', 'new'),
          ])
        );
        return ctx.wizard.next();
      }
    }
    await ctx.reply(ctx.wizard.state.questions[0]?.text, Markup.keyboard(['Skip']).oneTime());
    ctx.wizard.state.currentQuestion = 0;
    return ctx.wizard.selectStep(2); // Skip review step if no previous submission
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'review') {
        const user = await User.findOne({ telegramId: ctx.from!.id });
        const lastSubmission = await Submission.findById(user!.lastSubmissionId).populate('answers.questionId');
        if (lastSubmission) {
          ctx.wizard.state.answers = lastSubmission.answers;
          await ctx.reply(
            'Your previous answers:\n' +
            lastSubmission.answers
              .filter(a => !(a.questionId as any).confidential)
              .map(a => `${(a.questionId as any).text}: ${a.answer}`)
              .join('\n'),
            Markup.inlineKeyboard([
              Markup.button.callback('Edit', 'edit'),
              Markup.button.callback('Submit', 'submit'),
            ])
          );
          return ctx.wizard.next();
        }
      } else if (ctx.callbackQuery.data === 'new') {
        ctx.wizard.state.answers = [];
        await ctx.reply(ctx.wizard.state.questions[0]?.text, Markup.keyboard(['Skip']).oneTime());
        ctx.wizard.state.currentQuestion = 0;
        return ctx.wizard.selectStep(2);
      }
    }
  },
  ...Array(100).fill(null).map((_, index) => async (ctx: any) => {
    const questions = ctx.wizard.state.questions;
    if (index > 0 && ctx.message && 'text' in ctx.message && ctx.message.text !== 'Skip') {
      ctx.wizard.state.answers[index - 1] = {
        questionId: questions[index - 1]?._id,
        answer: ctx.message.text,
      };
    }
    if (index < questions.length) {
      await ctx.reply(questions[index].text, Markup.keyboard(['Skip']).oneTime());
      ctx.wizard.state.currentQuestion = index;
      return ctx.wizard.next();
    }

    const submission = new Submission({
      userId: ctx.from!.id,
      answers: ctx.wizard.state.answers,
      status: 'pending',
    });
    await submission.save();
    await User.updateOne(
      { telegramId: ctx.from!.id },
      { $set: { lastSubmissionId: submission._id } },
      { upsert: true }
    );

    const populatedSubmission = await Submission.findById(submission?._id).populate('answers.questionId');
    await ctx.reply(
      'Submission saved! Preview your answers:\n' +
      populatedSubmission!.answers
        .filter(a => !(a.questionId as any).confidential)
        .map(a => `${(a.questionId as any).text}: ${a.answer}`)
        .join('\n'),
      Markup.inlineKeyboard([
        Markup.button.callback('Submit', 'submit'),
        Markup.button.callback('Edit', 'edit'),
      ])
    );
    return ctx.wizard.next();
  }),
  async (ctx) => {
    console.log('Final step reached',ctx.callbackQuery );
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'submit') {
        console.log('Submitting answers for review');
        await ctx.reply('Submission sent for review!');
        return ctx.scene.leave();
      }
      if (ctx.callbackQuery.data === 'edit') {
        console.log('Editing submission');
        await ctx.reply(
          'Which question would you like to edit?',
          Markup.keyboard(ctx.wizard.state.questions.map((q:any) => q.text)).oneTime()
        ); 
        ctx.wizard.state.editing = true;
        return ctx.wizard.next();
      } 
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      const questionIndex = ctx.wizard.state.questions.findIndex((q:any) => q.text === ctx.message.text);
      if (questionIndex >= 0) {
        ctx.wizard.state.currentQuestion = questionIndex;
        await ctx.reply(ctx.wizard.state.questions[questionIndex].text);
        ctx.wizard.state.editingQuestion = questionIndex;
        return ctx.wizard.next();
      }
    } 
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      ctx.wizard.state.answers[ctx.wizard.state.editingQuestion] = {
        questionId: ctx.wizard.state.questions[ctx.wizard.state.editingQuestion]?._id,
        answer: ctx.message.text,
      };
      const submission = await Submission.findOneAndUpdate(
        { userId: ctx.from!.id, _id: (await User.findOne({ telegramId: ctx.from!.id }))!.lastSubmissionId },
        { $set: { answers: ctx.wizard.state.answers } },
        { new: true }
      );
      const populatedSubmission = await Submission.findById(submission!?._id).populate('answers.questionId');
      await ctx.reply(
        'Answer updated! Submit or continue editing.\n' +
        populatedSubmission!.answers
          .filter(a => !(a.questionId as any).confidential)
          .map(a => `${(a.questionId as any).text}: ${a.answer}`)
          .join('\n'),
        Markup.inlineKeyboard([
          Markup.button.callback('Submit', 'submit'),
          Markup.button.callback('Edit another', 'edit'),
        ])
      );
      return ctx.wizard.selectStep(ctx.wizard.state.currentQuestion + 3);
    }
  }
);