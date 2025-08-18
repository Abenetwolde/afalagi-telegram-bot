import { Scenes, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { logger } from '../services/logger.service';

// It is a best practice to have a single PrismaClient instance for your application.
// This instance should be created and exported in a separate file (e.g., ../services/prisma.ts).
// For this example, we'll create it here.
const prisma = new PrismaClient();

// Interface for wizard state
interface QuestionnaireState {
  questions: any[];
  answers: { questionId: number; answer: string }[];
  currentQuestion: number;
  editing?: boolean;
  editingQuestion?: number;
  editingQuestionIndex?: number;
  reviewing?: boolean;
}

// Helper function to format answers for display with numbering and italic answers
// Note: This now uses the 'included' question object from Prisma's `include`
const formatAnswers = (answers: any[], questions: any[]): string => {
  return answers
    .filter(a => {
      const question = questions.find(q => q.id === a.questionId);
      return question && !question.confidential;
    })
    .map((a, index) => {
      const question = questions.find(q => q.id === a.questionId);
      return `${index + 1}. ${question?.text || 'Unknown question'}\n_${a.answer || 'No answer provided'}_`;
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
    logger.info('Step 0: User registration and initial check');
    try {
      // Find a user by their unique telegramId, or create one if they don't exist
      let user = await prisma.user.upsert({
        where: { telegramId: ctx.from!.id },
        update: {},
        create: {
          telegramId: ctx.from!.id,
          username: ctx.from?.username || '',
        },
      });

      logger.info(`User upserted: ${user.telegramId}`);

      // Fetch all questions and store them in the wizard state
      ctx.wizard.state.questions = await prisma.question.findMany({
        orderBy: { id: 'asc' }, // Ensure a consistent order for questions
      });
      ctx.wizard.state.answers = [];
      ctx.wizard.state.currentQuestion = 0;
      ctx.wizard.state.editing = false;
      ctx.wizard.state.reviewing = false;

      // Check for a previous submission using the `lastSubmissionId` relation
      if (user.lastSubmissionId) {
        const lastSubmission = await prisma.submission.findUnique({
          where: { id: user.lastSubmissionId },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });

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

      // If no previous submission, proceed to the first question
      if (ctx.wizard.state.questions.length > 0) {
        logger.info('Sending first question:', ctx.wizard.state.questions[0].text);
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
    logger.info('Step 1: Handle review/new selection');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === 'review') {
          const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
          const lastSubmission = await prisma.submission.findUnique({
            where: { id: user!.lastSubmissionId! },
            include: {
              answers: {
                include: {
                  question: true,
                },
              },
            },
          });

          if (lastSubmission) {
            // Re-populate answers into the wizard state
            ctx.wizard.state.answers = lastSubmission.answers.map((a: any) => ({
              questionId: a.questionId,
              answer: a.answer,
            }));
            ctx.wizard.state.reviewing = true;

            await ctx.reply(
              'Your previous answers:\n' + formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
              '\n\nChoose an option:',
              { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
            );
            return ctx.wizard.selectStep(3);
          }
        } else if (ctx.callbackQuery.data === 'new') {
          ctx.wizard.state.answers = [];
          ctx.wizard.state.currentQuestion = 0;
          ctx.wizard.state.editing = false;
          ctx.wizard.state.reviewing = false;
          if (ctx.wizard.state.questions.length > 0) {
            logger.info('Sending first question for new submission:', ctx.wizard.state.questions[0].text);
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
    logger.info('Step 2: Question answering loop');
    try {
      // If in editing or reviewing mode, skip to appropriate step
      if (ctx.wizard.state.editing) {
        logger.info('Redirecting to edit step');
        await ctx.reply(
          'Your answers:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
          '\n\nEnter the number of the question you want to edit:',
          { reply_markup: Markup.removeKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(4);
      }
      if (ctx.wizard.state.reviewing) {
        logger.info('Redirecting to submit/edit step');
        await ctx.reply(
          'Your answers:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions) +
          '\n\nChoose an option:',
          { reply_markup: createSubmissionKeyboard().reply_markup, parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(3);
      }

      const questions = ctx.wizard.state.questions;
      logger.info('Total questions:', questions.length);
      const currentIndex = ctx.wizard.state.currentQuestion;
      logger.info('Current index:', currentIndex);

      if (!questions || questions.length === 0) {
        logger.error('No questions available in state');
        await ctx.reply('No questions available. Please try again later.');
        return ctx.scene.leave();
      }

      // Process answer for the previous question (if any)
      if (currentIndex > 0 && ctx.message && 'text' in ctx.message) {
        const questionId = questions[currentIndex - 1].id;
        const answerText = ctx.message.text !== 'Skip' ? ctx.message.text : 'Skipped';

        ctx.wizard.state.answers[currentIndex - 1] = {
          questionId,
          answer: answerText,
        };
      }

      // Check if there are more questions
      if (currentIndex < questions.length) {
        logger.info('Sending next question:', questions[currentIndex].text);
        await ctx.reply(
          questions[currentIndex].text,
          Markup.keyboard(['Skip']).oneTime()
        );
        ctx.wizard.state.currentQuestion = currentIndex + 1;
        return ctx.wizard.selectStep(2);
      }

      // Show preview when all questions are answered
      logger.info('All questions answered, showing preview');
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
  // Step 3: Handle back/edit
  async (ctx) => {
    logger.info('Step 3: Handle back/edit');
    try {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === 'back') {
          logger.info('Back button triggered, returning to review/new selection');
          await ctx.reply(
            'You have a previous submission. Would you like to review/edit it or start a new one?',
            Markup.inlineKeyboard([
              Markup.button.callback('Review/Edit', 'review'),
              Markup.button.callback('Start New', 'new'),
            ])
          );
          return ctx.wizard.selectStep(1);
        }
        if (ctx.callbackQuery.data === 'edit') {
          ctx.wizard.state.editing = true;
          ctx.wizard.state.reviewing = false;
          logger.info('Entering edit mode');
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
      logger.info('Checking for existing pending submission');
      const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
      const existingSubmission = await prisma.submission.findFirst({
        where: { userId: user!.id, status: 'pending' },
      });

      if (existingSubmission) {
        logger.info('Pending submission found:', existingSubmission.id);
        await ctx.reply(
          'You already have a pending submission. Please wait for review or edit your existing submission.',
          {
            reply_markup: Markup.inlineKeyboard([
              Markup.button.callback('View/Edit Submission', 'view_submission'),
            ]).reply_markup,
          }
        );
        return ctx.wizard.selectStep(3);
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
    logger.info('Step 4: Handle question number input');
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter the number of the question you want to edit:');
        return ctx.wizard.selectStep(4);
      }

      const input = ctx.message.text.trim();
      const questionNumber = parseInt(input, 10);
      const questionIndex = questionNumber - 1;

      if (isNaN(questionNumber) || questionIndex < 0 || questionIndex >= ctx.wizard.state.questions.length) {
        await ctx.reply(
          'Invalid question number. Please enter a valid number:\n' +
          formatAnswers(ctx.wizard.state.answers, ctx.wizard.state.questions),
          { parse_mode: 'Markdown' }
        );
        return ctx.wizard.selectStep(4);
      }

      ctx.wizard.state.editingQuestionIndex = questionIndex;
      logger.info(`Selected question ${questionNumber}: ${ctx.wizard.state.questions[questionIndex].text}`);

      await ctx.reply(
        `Editing question ${questionNumber}: ${ctx.wizard.state.questions[questionIndex].text}\nPlease enter your new answer:`,
        { reply_markup: Markup.removeKeyboard().reply_markup }
      );

      return ctx.wizard.selectStep(5);
    } catch (error) {
      logger.error('Error in question number input step:', error);
      await ctx.reply('An error occurred. Please try again.');
      return ctx.scene.leave();
    }
  },
  // Step 5: Handle new answer and update submission
  async (ctx) => {
    logger.info('Step 5: Handle new answer');
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter your new answer:');
        return ctx.wizard.selectStep(5);
      }

      const newAnswer = ctx.message.text.trim();
      const questionIndex = ctx.wizard.state.editingQuestionIndex;
      const questionId = ctx.wizard.state.questions[questionIndex].id;

      // Update answer in wizard state
      const answer = ctx.wizard.state.answers.find(
        (a: any) => a.questionId === questionId
      );
      if (answer) {
        answer.answer = newAnswer;
      } else {
        ctx.wizard.state.answers.push({
          questionId,
          answer: newAnswer,
        });
      }

      // Find the user to get their submission ID
      const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });

      if (user && user.lastSubmissionId) {
        // Find and update the specific answer record in the Answer table
        await prisma.answer.updateMany({
          where: {
            submissionId: user.lastSubmissionId,
            questionId,
          },
          data: {
            answer: newAnswer,
          },
        });

        // Update the submission's updatedAt field
        await prisma.submission.update({
          where: { id: user.lastSubmissionId },
          data: { updatedAt: new Date() },
        });

        logger.info(`Updated answer for question ${questionIndex + 1} in submission ${user.lastSubmissionId}`);
      } else {
        logger.warn(`No submission found for user ${ctx.from!.id}. Creating a new one.`);

        // Create a new submission as a fallback
        const submission = await prisma.submission.create({
          data: {
            user: { connect: { telegramId: ctx.from!.id } },
            answers: {
              create: ctx.wizard.state.answers.map((a: any) => ({
                answer: a.answer,
                question: { connect: { id: a.questionId } },
              })),
            },
            status: 'pending',
          },
          include: {
            answers: true
          }
        });

        // Update the user's lastSubmissionId
        await prisma.user.update({
          where: { telegramId: ctx.from!.id },
          data: { lastSubmission: { connect: { id: submission.id } } },
        });

        logger.info('New submission created with ID:', submission.id);
      }

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
  }
);
