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
  Markup.button.callback('Submit', 'submit'),
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
      
      // Register new user if not exists
      if (!user) {
        user = new User({
          telegramId: ctx.from!.id,
          username: ctx.from?.username || '',
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
  async (ctx) => {
    console.log('Step 3: Handle submit/edit');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === 'submit') {
          console.log('Saving submission to database');
          const submission = new Submission({
            userId: ctx.from!.id,
            answers: ctx.wizard.state.answers.filter((a: any) => a.answer && a.questionId),
            status: 'pending',
          });

          await submission.save();
          console.log('Submission saved with ID:', submission._id);
          await User.updateOne(
            { telegramId: ctx.from!.id },
            { $set: { lastSubmissionId: submission._id } },
            { upsert: true }
          );

          logger.info(`User ${ctx.from!.id} submitted answers for review`);
          await ctx.reply('Submission sent for review!');
          return ctx.scene.leave();
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
      // If no valid callback, stay in submit/edit step
      await ctx.reply(
        'Please choose an option:',
        { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger.error('Error in submit/edit step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 4: Select question to edit
  async (ctx) => {
    console.log('Step 4: Select question to edit');
    try {
      // Ensure user is in editing mode
      if (!ctx.wizard.state.editing) {
        console.log('User not in editing mode');
        await ctx.reply(
          'Please click "Edit" to modify your answers.',
          { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(3);
      }

      if (ctx.message && 'text' in ctx.message) {
        if (ctx.message.text === 'Back') {
          console.log('User clicked Back');
          ctx.wizard.state.editing = false;
          await ctx.reply(
            'Your answers:\n' +
            formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
            '\n\nChoose an option:',
            { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(3);
        }

        const questionNumber = parseInt(ctx.message.text) - 1; // Convert to 0-based index
        if (questionNumber >= 0 && questionNumber < ctx.wizard.state.questions.length) {
          ctx.wizard.state.editingQuestion = questionNumber;
          console.log('Selected question for editing:', ctx.wizard.state.questions[questionNumber].text);
          await ctx.reply(
            ctx.wizard.state.questions[questionNumber].text,
            createBackKeyboard()
          );
          return ctx.wizard.selectStep(5);
        } else {
          console.log('Invalid question number entered:', ctx.message.text);
          await ctx.reply(
            'Invalid question number. Please enter a valid number:\n' +
            formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions),
            { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(4); // Stay in this step for valid input
        }
      }

      await ctx.reply(
        'Please enter the number of the question to edit.',
        { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error in question selection:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 5: Update answer
  async (ctx) => {
    console.log('Step 5: Update answer');
    try {
      if (ctx.message && 'text' in ctx.message) {
        if (ctx.message.text === 'Back') {
          console.log('User clicked Back');
          ctx.wizard.state.editing = false;
          await ctx.reply(
            'Your answers:\n' +
            formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
            '\n\nChoose an option:',
            { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
          );
          return ctx.wizard.selectStep(3);
        }

        const { editingQuestion, questions, answers } = ctx.wizard.state;
        answers[editingQuestion] = {
          questionId: questions[editingQuestion]._id.toString(),
          answer: ctx.message.text,
        };

        console.log('Updated answer for question:', questions[editingQuestion].text);
        await ctx.reply(
          'Answer updated!\n\nUpdated answers:\n' +
          formatAnswers(answers, questions) +
          '\n\nChoose an option or enter another question number to edit:',
          { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        ctx.wizard.state.editing = false;
        return ctx.wizard.selectStep(3); // Return to submit/edit step
      }

      await ctx.reply('Please enter your updated answer.', createBackKeyboard());
    } catch (error) {
      logger.error('Error updating answer:', error);
      await ctx.reply('An error occurred while updating your answer.');
      return ctx.scene.leave();
    }
  }
);