import { Scenes, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { User } from '../models/user.model';
import { Question } from '../models/question.model';
import { logger } from '../services/logger.service';

// Interface for wizard state
interface UserSceneState {
  submissions: any[];
  selectedSubmissionId?: string;
  editing?: boolean;
  editingQuestion?: number;
  answers?: { questionId: string; answer: string }[];
  questions?: any[];
}

// Helper function to format submission list
const formatSubmissionList = (submissions: any[]): string => {
  if (submissions.length === 0) {
    return 'You have no submissions.';
  }
  return submissions
    .map((s, index) => {
      const date = new Date(s.createdAt).toLocaleDateString();
      return `${index + 1}. Submission ID: ${s._id}\nStatus: ${s.status}\nCreated: ${date}`;
    })
    .join('\n\n');
};

// Helper function to format submission details
const formatSubmissionDetails = (submission: any, questions: any[]): string => {
  console.log('Formatting submission details for:', submission._id);
  console.log('Submission answers:', JSON.stringify(submission.answers, null, 2));
  console.log('Questions available:', JSON.stringify(questions, null, 2));

  if (!submission.answers || submission.answers.length === 0) {
    return `Submission ID: ${submission._id}\nStatus: ${submission.status}\nCreated: ${new Date(submission.createdAt).toLocaleDateString()}\n\nAnswers: No answers available.`;
  }

  const answers = submission.answers
    .filter((a: any) => {
      if (!a.questionId || !a.questionId._id) {
        console.log('Skipping answer with missing or invalid questionId:', a);
        return false;
      }
      const question = questions.find(q => q._id.toString() === a.questionId._id.toString());
      if (!question) {
        console.log('No matching question found for answer with questionId:', a.questionId._id.toString());
        return false;
      }
      return !question.confidential;
    })
    .map((a: any, index: number) => {
      const question = questions.find(q => q._id.toString() === a.questionId._id.toString());
      return `${index + 1}. ${question?.text || 'Unknown question'}\n_${a.answer || 'No answer provided'}_`;
    })
    .join('\n\n');

  return `Submission ID: ${submission._id}\nStatus: ${submission.status}\nCreated: ${new Date(submission.createdAt).toLocaleDateString()}\n\nAnswers:\n${answers || 'No valid answers found.'}`;
};

// Helper function to create submission selection keyboard
const createSubmissionSelectionKeyboard = (submissions: any[]) => {
  const buttons = submissions.map((s, index) =>
    Markup.button.callback(`Submission ${index + 1} (${s.status})`, `select_${s._id}`)
  );
  return Markup.inlineKeyboard(buttons, { columns: 1 });
};

// Helper function to create action keyboard for pending submissions
const createActionKeyboard = () => Markup.inlineKeyboard([
  Markup.button.callback('Cancel', 'cancel'),
  Markup.button.callback('Edit', 'edit'),
  Markup.button.callback('Back', 'back'),
]);

// Helper function to create confirmation keyboard for cancellation
const createConfirmationKeyboard = () => Markup.inlineKeyboard([
  Markup.button.callback('Yes', 'confirm_cancel'),
  Markup.button.callback('No', 'back'),
]);

// Helper function to create back keyboard
const createBackKeyboard = () => Markup.keyboard(['Back']).oneTime();

export const userScene = new Scenes.WizardScene<any>(
  'user',
  // Step 0: List all submissions
  async (ctx) => {
    console.log('Step 0: List user submissions');
    try {
      const user = await User.findOne({ telegramId: ctx.from!.id });
      if (!user) {
        await ctx.reply('You are not registered. Please start with /start.');
        return ctx.scene.leave();
      }

      const submissions = await Submission.find({ userId: ctx.from!.id })
        .populate('answers.questionId')
        .sort({ createdAt: -1 });
      ctx.wizard.state.submissions = submissions;

      if (submissions.length === 0) {
        await ctx.reply('You have no submissions.');
        return ctx.scene.leave();
      }

      await ctx.reply(
        'Your submissions:\n' + formatSubmissionList(submissions) + '\n\nSelect a submission to view details:',
        createSubmissionSelectionKeyboard(submissions)
      );
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error listing submissions:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 1: Show submission details and actions
  async (ctx) => {
    console.log('Step 1: Show submission details');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('select_')) {
          const submissionId = data.replace('select_', '');
          const submission = await Submission.findById(submissionId).populate('answers.questionId');
          if (!submission) {
            await ctx.reply('Submission not found.');
            return ctx.scene.leave();
          }

          ctx.wizard.state.selectedSubmissionId = submissionId;
          ctx.wizard.state.questions = await Question.find();
          ctx.wizard.state.editing = false;

          if (submission.status === 'pending') {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) + '\n\nChoose an action:',
              { reply_markup: createActionKeyboard().reply_markup, parse_mode: 'Markdown' }
            );
          } else {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) + '\n\nThis submission is not pending, so it cannot be edited or canceled.',
              { reply_markup: Markup.inlineKeyboard([Markup.button.callback('Back', 'back')]).reply_markup, parse_mode: 'Markdown' }
            );
          }
          return ctx.wizard.next();
        }
      }
      await ctx.reply('Please select a submission.', createSubmissionSelectionKeyboard(ctx.wizard.state.submissions));
      return ctx.wizard.selectStep(1);
    } catch (error) {
      logger.error('Error showing submission details:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Handle actions (cancel, edit, back)
  async (ctx) => {
    console.log('Step 2: Handle submission actions');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        const submissionId = ctx.wizard.state.selectedSubmissionId;
        const submission = await Submission.findById(submissionId).populate('answers.questionId');

        if (!submission) {
          await ctx.reply('Submission not found.');
          return ctx.scene.leave();
        }

        if (data === 'back') {
          await ctx.reply(
            'Your submissions:\n' + formatSubmissionList(ctx.wizard.state.submissions) + '\n\nSelect a submission to view details:',
            createSubmissionSelectionKeyboard(ctx.wizard.state.submissions)
          );
          return ctx.wizard.selectStep(1);
        }

        if (data === 'cancel' && submission.status === 'pending') {
          await ctx.reply(
            'Are you sure you want to cancel this submission? This action cannot be undone.',
            createConfirmationKeyboard()
          );
          return ctx.wizard.selectStep(2);
        }

        if (data === 'confirm_cancel' && submission.status === 'pending') {
          await Submission.deleteOne({ _id: submissionId });
          const user = await User.findOne({ telegramId: ctx.from!.id });
          if (user && user.lastSubmissionId?.toString() === submissionId) {
            await User.updateOne({ telegramId: ctx.from!.id }, { $unset: { lastSubmissionId: '' } });
          }
          logger.info(`User ${ctx.from!.id} canceled submission ${submissionId}`);
          await ctx.reply('Submission canceled successfully.');
          return ctx.scene.leave();
        }

        if (data === 'edit' && submission.status === 'pending') {
          ctx.wizard.state.editing = true;
          ctx.wizard.state.answers = submission.answers.map((a: any) => ({
            questionId: a.questionId?._id.toString(),
            answer: a.answer
          }));
          await ctx.reply(
            'Your answers:\n' +
            formatSubmissionDetails(submission, ctx.wizard.state.questions) +
            '\n\nEnter the number of the question you want to edit:',
            { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(3);
        }
      }

      await ctx.reply('Please choose an action.', createActionKeyboard());
      return ctx.wizard.selectStep(2);
    } catch (error) {
      logger.error('Error handling submission actions:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Select question to edit
  async (ctx) => {
    console.log('Step 3: Select question to edit');
    try {
      if (!ctx.wizard.state.editing) {
        console.log('User not in editing mode');
        await ctx.reply(
          'Please click "Edit" to modify your answers.',
          { reply_markup: createActionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(2);
      }

      if (ctx.message && 'text' in ctx.message) {
        if (ctx.message.text === 'Back') {
          console.log('User clicked Back');
          ctx.wizard.state.editing = false;
          const submission = await Submission.findById(ctx.wizard.state.selectedSubmissionId).populate('answers.questionId');
          if (submission) {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) + '\n\nChoose an action:',
              { reply_markup: createActionKeyboard().reply_markup, parse_mode: 'Markdown' }
            );
          }
          return ctx.wizard.selectStep(2);
        }

        const questionNumber = parseInt(ctx.message.text) - 1; // Convert to 0-based index
        if (questionNumber >= 0 && questionNumber < ctx.wizard.state.questions.length) {
          ctx.wizard.state.editingQuestion = questionNumber;
          console.log('Selected question for editing:', ctx.wizard.state.questions[questionNumber].text);
          await ctx.reply(
            ctx.wizard.state.questions[questionNumber].text,
            createBackKeyboard()
          );
          return ctx.wizard.selectStep(4);
        } else {
          console.log('Invalid question number entered:', ctx.message.text);
          await ctx.reply(
            'Invalid question number. Please enter a valid number:\n' +
            formatSubmissionDetails(
              { _id: ctx.wizard.state.selectedSubmissionId, answers: ctx.wizard.state.answers, status: 'pending', createdAt: new Date() },
              ctx.wizard.state.questions
            ),
            { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(3); // Stay in this step for valid input
        }
      }

      await ctx.reply(
        'Please enter the number of the question to edit.',
        { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger.error('Error in question selection:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 4: Update answer
  async (ctx) => {
    console.log('Step 4: Update answer');
    try {
      if (ctx.message && 'text' in ctx.message) {
        if (ctx.message.text === 'Back') {
          console.log('User clicked Back');
          ctx.wizard.state.editing = false;
          const submission = await Submission.findById(ctx.wizard.state.selectedSubmissionId).populate('answers.questionId');
          if (submission) {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) + '\n\nChoose an action:',
              { reply_markup: createActionKeyboard().reply_markup, parse_mode: 'Markdown' }
            );
          }
          return ctx.wizard.selectStep(2);
        }

        const { editingQuestion, questions, answers, selectedSubmissionId } = ctx.wizard.state;
        answers[editingQuestion] = {
          questionId: questions[editingQuestion]._id.toString(),
          answer: ctx.message.text,
        };

        // Save updated answers as a new submission
        const submission = new Submission({
          userId: ctx.from!.id,
          answers: answers.filter((a: any) => a.answer && a.questionId),
          status: 'pending',
        });
        await submission.save();
        console.log('New submission saved with ID:', submission._id);
        await User.updateOne(
          { telegramId: ctx.from!.id },
          { $set: { lastSubmissionId: submission._id } },
          { upsert: true }
        );

        // Delete the old submission
        await Submission.deleteOne({ _id: selectedSubmissionId });

        logger.info(`User ${ctx.from!.id} edited submission ${selectedSubmissionId}, new submission ${submission._id}`);
        await ctx.reply(
          'Answer updated!\n\nUpdated answers:\n' +
          formatSubmissionDetails({ _id: submission._id, answers, status: 'pending', createdAt: new Date() }, questions) +
          '\n\nChoose an action:',
          { reply_markup: createActionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        ctx.wizard.state.editing = false;
        ctx.wizard.state.selectedSubmissionId = submission._id; // Update to new submission
        return ctx.wizard.selectStep(2); // Return to action step
      }

      await ctx.reply('Please enter your updated answer.', createBackKeyboard());
      return ctx.wizard.selectStep(4);
    } catch (error) {
      logger.error('Error updating answer:', error);
      await ctx.reply('An error occurred while updating your answer.');
      return ctx.scene.leave();
    }
  }
);