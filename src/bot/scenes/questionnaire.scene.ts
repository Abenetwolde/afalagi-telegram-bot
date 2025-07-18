import { Scenes, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { User } from '../models/user.model';
import { Question } from '../models/question.model';
import { logger } from '../services/logger.service';

// Interface for wizard state
interface QuestionnaireState {
  questions: any[];
  answers: { questionId: string; answer: string }[];
  currentQuestion: number;
  editing?: boolean;
  editingQuestion?: number;
  reviewing?: boolean; // New state to track review mode
}

// Helper function to format answers for display with numbering and italic answers
const formatAnswers = (answers: any[], questions: any[]): string => {
  return answers
    .filter(a => {
      const question = questions.find(q => q._id.toString() === a.questionId.toString());
      return question && !question.confidential;
    })
    .map((a, index) => {
      const question = questions.find(q => q._id.toString() === a.questionId.toString());
      return `${index + 1}. ${question.text}\n_${a.answer}_`;
    })
    .join('\n\n');
};

// Helper function to create submission keyboard
const createSubmissionKeyboard = () => Markup.inlineKeyboard([
  Markup.button.callback('Back', 'back'),
  Markup.button.callback('Edit', 'edit'),
]);
// Helper function to create back keyboard
const createBackKeyboard = () => Markup.keyboard(['Back']).oneTime();

export const questionnaireScene = new Scenes.WizardScene<any>(
  'questionnaire',
  // Step 0: User registration and initial check for previous submission
  async (ctx) => {
    console.log('Step 0: User registration and initial check');
    try {
      let user = await User.findOne({ telegramId: ctx.from!.id });
      
      console.log('User found:', user ? user.telegramId : 'No user found');
      // Register new user if not exists
      if (!user) {
        user = new User({
          telegramId: ctx.from!.id,
          username: ctx.from?.username || '',
          isAdmin: false, // Default to false, can be updated later
          createdAt: new Date(),
        });
        await user.save();
        logger.info(`New user registered: ${ctx.from!.id}`);
      }

      ctx.wizard.state.questions = await Question.find().sort();
      ctx.wizard.state.answers = [];
      ctx.wizard.state.currentQuestion = 0;
      ctx.wizard.state.editing = false;
      ctx.wizard.state.reviewing = false;

      if (user.lastSubmissionId) {
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

      // Send first question only if no previous submission
      if (ctx.wizard.state.questions.length > 0) {
        console.log('Sending first question:', ctx.wizard.state.questions[0].text);
        await ctx.reply(
          ctx.wizard.state.questions[0].text,
          Markup.keyboard(['Skip']).oneTime()
        );
        return ctx.wizard.selectStep(2);
      } else {
        logger.error('No questions available in state');
        await ctx.reply('No questions available. Please try again later.');
        return ctx.scene.leave();
      }
    } catch (error) {
      logger.error('Error in initial step:', error);
      await ctx.reply('An error occurred. Please try again later.');
      return ctx.scene.leave();
    }
  },
  // Step 1: Handle review/new selection
  async (ctx) => {
    console.log('Step 1: Handle review/new selection');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === 'review') {
          const user = await User.findOne({ telegramId: ctx.from!.id });
          const lastSubmission = await Submission.findById(user!.lastSubmissionId).populate('answers.questionId');
          
          if (lastSubmission) {
            ctx.wizard.state.answers = lastSubmission.answers.map((a: any) => ({
              questionId: a.questionId?._id.toString(),
              answer: a.answer
            }));
            ctx.wizard.state.reviewing = true; // Indicate review mode
            
            await ctx.reply(
              'Your previous answers:\n' + formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) + 
              '\n\nChoose an option:',
              { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
            );
            return ctx.wizard.selectStep(3); // Skip to submit/edit step
          }
        } else if (ctx.callbackQuery.data === 'new') {
          ctx.wizard.state.answers = [];
          ctx.wizard.state.currentQuestion = 0;
          ctx.wizard.state.editing = false;
          ctx.wizard.state.reviewing = false;
          if (ctx.wizard.state.questions.length > 0) {
            console.log('Sending first question for new submission:', ctx.wizard.state.questions[0].text);
            await ctx.reply(
              ctx.wizard.state.questions[0].text,
              Markup.keyboard(['Skip']).oneTime()
            );
            return ctx.wizard.selectStep(2);
          } else {
            logger.error('No questions available in state');
            await ctx.reply('No questions available. Please try again later.');
            return ctx.scene.leave();
          }
        }
      }
    } catch (error) {
      logger.error('Error in review step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 2: Question answering loop
  async (ctx) => {
    console.log('Step 2: Question answering loop');
    try {
      // If in editing or reviewing mode, skip to appropriate step
      if (ctx.wizard.state.editing) {
        console.log('Redirecting to edit step');
        await ctx.reply(
          'Your answers:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
          '\n\nEnter the number of the question you want to edit:',
          { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(4);
      }
      if (ctx.wizard.state.reviewing) {
        console.log('Redirecting to submit/edit step');
        await ctx.reply(
          'Your answers:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
          '\n\nChoose an option:',
          { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(3);
      }

      const questions = ctx.wizard.state.questions;
      console.log('Total questions:', questions.length);
      const currentIndex = ctx.wizard.state.currentQuestion;
      console.log('Current index:', currentIndex);

      // Ensure questions exist
      if (!questions || questions.length === 0) {
        logger.error('No questions available in state');
        await ctx.reply('No questions available. Please try again later.');
        return ctx.scene.leave();
      }

      // Process answer for the previous question (if any)
      if (currentIndex > 0 && ctx.message && 'text' in ctx.message) {
        if (ctx.message.text !== 'Skip') {
          console.log('Saving answer for question:', questions[currentIndex - 1].text);
          ctx.wizard.state.answers[currentIndex - 1] = {
            questionId: questions[currentIndex - 1]._id.toString(),
            answer: ctx.message.text,
          };
        } else {
          console.log('Skipping question:', questions[currentIndex - 1].text);
          ctx.wizard.state.answers[currentIndex - 1] = {
            questionId: questions[currentIndex - 1]._id.toString(),
            answer: 'Skipped',
          };
        }
      }

      // Check if there are more questions
      if (currentIndex < questions.length) {
        console.log('Sending next question:', questions[currentIndex].text);
        await ctx.reply(
          questions[currentIndex].text,
          Markup.keyboard(['Skip']).oneTime()
        );
        ctx.wizard.state.currentQuestion = currentIndex + 1;
        return ctx.wizard.selectStep(2); // Stay in the question loop
      }

      // Show preview when all questions are answered
      console.log('All questions answered, showing preview');
      await ctx.reply(
        'Preview your answers:\n' +
        formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
        '\n\nPlease review your answers and choose an option:',
        { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger.error('Error in question loop:', error);
      await ctx.reply('An error occurred while processing your answers.');
      return ctx.scene.leave();
    }
  },
  // Step 3: Handle submit/edit
// Step 3: Handle back/edit (unchanged)
async (ctx) => {
    console.log('Step 3: Handle back/edit');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === 'back') {
          console.log('Back button triggered, returning to review/new selection');
          await ctx.reply(
            'You have a previous submission. Would you like to review/edit it or start a new one?',
            Markup.inlineKeyboard([
              Markup.button.callback('Review/Edit', 'review'),
              Markup.button.callback('Start New', 'new'),
            ])
          );
          return ctx.wizard.selectStep(1); // Return to Step 1
        }
        if (ctx.callbackQuery.data === 'edit') {
          ctx.wizard.state.editing = true;
          ctx.wizard.state.reviewing = false;
          console.log('Entering edit mode');
          await ctx.reply(
            'Your answers:\n' +
            formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
            '\n\nEnter the number of the question you want to edit:',
            { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(4);
        }
      }
      // Check for pending submission before showing keyboard
      console.log('Checking for existing pending submission');
      const existingSubmission = await Submission.findOne({
        userId: ctx.from!.id,
        status: 'pending',
      });

      if (existingSubmission) {
        console.log('Pending submission found:', existingSubmission._id);
        await ctx.reply(
          'You already have a pending submission. Please wait for review or edit your existing submission.',
          {
            reply_markup: Markup.inlineKeyboard([
              Markup.button.callback('View/Edit Submission', 'view_submission'),
            ]).reply_markup,
          }
        );
        // Register action handler for View/Edit button
        ctx.scene.session.actionHandler = ctx.scene.action('view_submission', async (ctx:any) => {
          console.log('Inline button: View/Edit Submission triggered');
          await ctx.scene.leave();
          await ctx.scene.enter('user');
        });
        return ctx.wizard.selectStep(3); // Stay in Step 3
      }

      // If no valid callback and no pending submission, show back/edit keyboard
      await ctx.reply(
        'Please choose an option:',
        { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger.error('Error in back/edit step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },

// Step 4: Handle question number input and answer update
async (ctx) => {
    console.log('Step 4: Handle question number input');
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter the number of the question you want to edit:');
        return ctx.wizard.selectStep(4);
      }

      const input = ctx.message.text.trim();
      const questionNumber = parseInt(input, 10);
      const questionIndex = questionNumber - 1; // Convert to 0-based index

      // Validate question number
      if (isNaN(questionNumber) || questionIndex < 0 || questionIndex >= ctx.wizard.state.questions.length) {
        await ctx.reply(
          'Invalid question number. Please enter a valid number:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions),
          { parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(4);
      }

      // Store the selected question index
      ctx.wizard.state.editingQuestionIndex = questionIndex;
      console.log(`Selected question ${questionNumber}: ${ctx.wizard.state.questions[questionIndex].text}`);

      // Prompt for new answer
      await ctx.reply(
        `Editing question ${questionNumber}: ${ctx.wizard.state.questions[questionIndex].text}\nPlease enter your new answer:`,
        { reply_markup: Markup.removeKeyboard().reply_markup }
      );

      // Move to Step 5 to handle the new answer
      return ctx.wizard.selectStep(5);
    } catch (error) {
      logger.error('Error in question number input step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },

// Step 5: Handle new answer and update submission
async (ctx) => {
    console.log('Step 5: Handle new answer');
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter your new answer:');
        return ctx.wizard.selectStep(5);
      }

      const newAnswer = ctx.message.text.trim();
      const questionIndex = ctx.wizard.state.editingQuestionIndex;

      // Update answer in wizard state
      const answer = ctx.wizard.state.answers.find(
        (a: any) => a.questionId === ctx.wizard.state.questions[questionIndex]._id.toString()
      );
      if (answer) {
        answer.answer = newAnswer;
      } else {
        ctx.wizard.state.answers.push({
          questionId: ctx.wizard.state.questions[questionIndex]._id.toString(),
          answer: newAnswer,
        });
      }

      // Update Submission in database
      const user = await User.findOne({ telegramId: ctx.from!.id });
      if (user && user.lastSubmissionId) {
        await Submission.updateOne(
          { _id: user.lastSubmissionId, userId: ctx.from!.id },
          {
            $set: {
              'answers.$[elem].answer': newAnswer,
              updatedAt: new Date(),
            },
          },
          {
            arrayFilters: [{ 'elem.questionId': ctx.wizard.state.questions[questionIndex]._id }],
          }
        );
        console.log(`Updated answer for question ${questionIndex + 1} in submission ${user.lastSubmissionId}`);
      } else {
        logger.warn(`No submission found for user ${ctx.from!.id}`);
        await ctx.reply('No submission found to update. Starting a new submission.');

        // Create a new submission as fallback
        const submission = new Submission({
          userId: ctx.from!.id,
          answers: ctx.wizard.state.answers.filter((a: any) => a.answer && a.questionId),
          status: 'pending',
        });
        await submission.save();
        await User.updateOne(
          { telegramId: ctx.from!.id },
          { $set: { lastSubmissionId: submission._id } },
          { upsert: true }
        );
        console.log('New submission created with ID:', submission._id);
      }

      // Return to Step 3 to show updated answers
      await ctx.reply(
        'Answer updated! Your answers:\n' +
        formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
        '\n\nChoose an option:',
        { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger.error('Error in answer update step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
);