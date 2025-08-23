"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userScene = void 0;
const telegraf_1 = require("telegraf");
const client_1 = require("@prisma/client");
const logger_service_1 = require("../services/logger.service");
// It is best practice to have a single PrismaClient instance for your application.
// This instance should be created and exported in a separate file (e.g., ../services/prisma.ts)
// For this example, we'll create it here.
const prisma = new client_1.PrismaClient();
// Helper function to format submission list
const formatSubmissionList = (submissions) => {
  if (submissions.length === 0) {
    return "You have no submissions.";
  }
  return submissions
    .map((s, index) => {
      const date = s.createdAt.toLocaleDateString();
      return `${index + 1}. Submission ID: ${s.id}\nStatus: ${s.status}\nCreated: ${date}`;
    })
    .join("\n\n");
};
// Helper function to format submission details
// We now expect 'answers' to have an 'included' question object
const formatSubmissionDetails = (submission, questions) => {
  if (!submission.answers || submission.answers.length === 0) {
    return `Submission ID: ${submission.id}\nStatus: ${submission.status}\nCreated: ${submission.createdAt.toLocaleDateString()}\n\nAnswers: No answers available.`;
  }
  const answers = submission.answers
    .filter((a) => {
      // Access the included question object
      return a.question && !a.question.confidential;
    })
    .map((a, index) => {
      // Access the included question text directly
      return `${index + 1}. ${a.question.text || "Unknown question"}\n_${a.answer || "No answer provided"}_`;
    })
    .join("\n\n");
  return `Submission ID: ${submission.id}\nStatus: ${submission.status}\nCreated: ${submission.createdAt.toLocaleDateString()}\n\nAnswers:\n${answers || "No valid answers found."}`;
};
// Helper function to create submission selection keyboard
const createSubmissionSelectionKeyboard = (submissions) => {
  const buttons = submissions.map((s, index) =>
    telegraf_1.Markup.button.callback(
      `Submission ${index + 1} (${s.status})`,
      `select_${s.id}`,
    ),
  );
  return telegraf_1.Markup.inlineKeyboard(buttons, { columns: 1 });
};
// Helper function to create action keyboard for pending submissions
const createActionKeyboard = () =>
  telegraf_1.Markup.inlineKeyboard([
    telegraf_1.Markup.button.callback("Cancel", "cancel"),
    telegraf_1.Markup.button.callback("Edit", "edit"),
    telegraf_1.Markup.button.callback("Back", "back"),
  ]);
// Helper function to create confirmation keyboard for cancellation
const createConfirmationKeyboard = () =>
  telegraf_1.Markup.inlineKeyboard([
    telegraf_1.Markup.button.callback("Yes", "confirm_cancel"),
    telegraf_1.Markup.button.callback("No", "back"),
  ]);
// Helper function to create back keyboard
const createBackKeyboard = () => telegraf_1.Markup.keyboard(["Back"]).oneTime();
exports.userScene = new telegraf_1.Scenes.WizardScene(
  "user",
  // Step 0: List all submissions
  async (ctx) => {
    console.log("userid==================", ctx.from.id);
    logger_service_1.logger.info("Step 0: List user submissions");
    try {
      // Find a user by their unique telegramId
      const user = await prisma.user.findUnique({
        where: { telegramId: ctx.from.id },
      });
      console.log("user", user);
      if (!user) {
        await ctx.reply("You are not registered. Please start with /start.");
        return ctx.scene.leave();
      }
      // Find all submissions for the user and include their answers and the related question
      const submissions = await prisma.submission.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          answers: {
            include: {
              question: true,
            },
          },
        },
      });
      ctx.wizard.state.submissions = submissions;
      if (submissions.length === 0) {
        await ctx.reply("You have no submissions.");
        return ctx.scene.leave();
      }
      await ctx.reply(
        "Your submissions:\n" +
          formatSubmissionList(submissions) +
          "\n\nSelect a submission to view details:",
        createSubmissionSelectionKeyboard(submissions),
      );
      return ctx.wizard.next();
    } catch (error) {
      logger_service_1.logger.error("Error listing submissions:", error);
      await ctx.reply("An error occurred. Please try again.");
      return ctx.scene.leave();
    }
  },
  // Step 1: Show submission details and actions
  async (ctx) => {
    logger_service_1.logger.info("Step 1: Show submission details");
    try {
      if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (data.startsWith("select_")) {
          const submissionId = parseInt(data.replace("select_", ""), 10);
          // Find the submission by its unique ID and include nested answers and questions
          const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: {
              answers: {
                include: {
                  question: true,
                },
              },
            },
          });
          if (!submission) {
            await ctx.reply("Submission not found.");
            return ctx.scene.leave();
          }
          ctx.wizard.state.selectedSubmissionId = submissionId;
          ctx.wizard.state.questions = await prisma.question.findMany(); // Fetch all questions
          ctx.wizard.state.editing = false;
          if (submission.status === "pending") {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) +
                "\n\nChoose an action:",
              {
                reply_markup: createActionKeyboard().reply_markup,
                parse_mode: "Markdown",
              },
            );
          } else {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) +
                "\n\nThis submission is not pending, so it cannot be edited or canceled.",
              {
                reply_markup: telegraf_1.Markup.inlineKeyboard([
                  telegraf_1.Markup.button.callback("Back", "back"),
                ]).reply_markup,
                parse_mode: "Markdown",
              },
            );
          }
          return ctx.wizard.next();
        }
      }
      await ctx.reply(
        "Please select a submission.",
        createSubmissionSelectionKeyboard(ctx.wizard.state.submissions),
      );
      return ctx.wizard.selectStep(1);
    } catch (error) {
      logger_service_1.logger.error("Error showing submission details:", error);
      await ctx.reply("An error occurred. Please try again.");
      return ctx.scene.leave();
    }
  },
  // Step 2: Handle actions (cancel, edit, back)
  async (ctx) => {
    logger_service_1.logger.info("Step 2: Handle submission actions");
    try {
      if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        const submissionId = ctx.wizard.state.selectedSubmissionId;
        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
        if (!submission) {
          await ctx.reply("Submission not found.");
          return ctx.scene.leave();
        }
        if (data === "back") {
          await ctx.reply(
            "Your submissions:\n" +
              formatSubmissionList(ctx.wizard.state.submissions) +
              "\n\nSelect a submission to view details:",
            createSubmissionSelectionKeyboard(ctx.wizard.state.submissions),
          );
          return ctx.wizard.selectStep(1);
        }
        if (data === "cancel" && submission.status === "pending") {
          await ctx.reply(
            "Are you sure you want to cancel this submission? This action cannot be undone.",
            createConfirmationKeyboard(),
          );
          return ctx.wizard.selectStep(2);
        }
        if (data === "confirm_cancel" && submission.status === "pending") {
          // Delete the submission
          await prisma.submission.delete({ where: { id: submissionId } });
          const user = await prisma.user.findUnique({
            where: { telegramId: ctx.from.id },
          });
          if (user && user.lastSubmissionId === submissionId) {
            // Unset the lastSubmissionId by setting it to null
            await prisma.user.update({
              where: { telegramId: ctx.from.id },
              data: { lastSubmissionId: null },
            });
          }
          logger_service_1.logger.info(
            `User ${ctx.from.id} canceled submission ${submissionId}`,
          );
          await ctx.reply("Submission canceled successfully.");
          return ctx.scene.leave();
        }
        if (data === "edit" && submission.status === "pending") {
          ctx.wizard.state.editing = true;
          // Store answers with their question IDs as numbers
          ctx.wizard.state.answers = submission.answers.map((a) => ({
            questionId: a.questionId,
            answer: a.answer,
          }));
          await ctx.reply(
            "Your answers:\n" +
              formatSubmissionDetails(submission, ctx.wizard.state.questions) +
              "\n\nEnter the number of the question you want to edit:",
            {
              reply_markup: telegraf_1.Markup.removeKeyboard().reply_markup,
              parse_mode: "Markdown",
            },
          );
          return ctx.wizard.selectStep(3);
        }
      }
      await ctx.reply("Please choose an action.", createActionKeyboard());
      return ctx.wizard.selectStep(2);
    } catch (error) {
      logger_service_1.logger.error(
        "Error handling submission actions:",
        error,
      );
      await ctx.reply("An error occurred. Please try again.");
      return ctx.scene.leave();
    }
  },
  // Step 3: Select question to edit
  async (ctx) => {
    logger_service_1.logger.info("Step 3: Select question to edit");
    try {
      if (!ctx.wizard.state.editing) {
        await ctx.reply('Please click "Edit" to modify your answers.', {
          reply_markup: createActionKeyboard().reply_markup,
          parse_mode: "Markdown",
        });
        return ctx.wizard.selectStep(2);
      }
      if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === "Back") {
          ctx.wizard.state.editing = false;
          const submission = await prisma.submission.findUnique({
            where: { id: ctx.wizard.state.selectedSubmissionId },
            include: { answers: { include: { question: true } } },
          });
          if (submission) {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) +
                "\n\nChoose an action:",
              {
                reply_markup: createActionKeyboard().reply_markup,
                parse_mode: "Markdown",
              },
            );
          }
          return ctx.wizard.selectStep(2);
        }
        const questionNumber = parseInt(ctx.message.text, 10) - 1; // Convert to 0-based index
        if (
          questionNumber >= 0 &&
          questionNumber < ctx.wizard.state.questions.length
        ) {
          ctx.wizard.state.editingQuestion = questionNumber;
          await ctx.reply(
            ctx.wizard.state.questions[questionNumber].text,
            createBackKeyboard(),
          );
          return ctx.wizard.selectStep(4);
        } else {
          await ctx.reply(
            "Invalid question number. Please enter a valid number.",
            { reply_markup: telegraf_1.Markup.removeKeyboard().reply_markup },
          );
          return ctx.wizard.selectStep(3); // Stay in this step for valid input
        }
      }
      await ctx.reply("Please enter the number of the question to edit.", {
        reply_markup: telegraf_1.Markup.removeKeyboard().reply_markup,
      });
      return ctx.wizard.selectStep(3);
    } catch (error) {
      logger_service_1.logger.error("Error in question selection:", error);
      await ctx.reply("An error occurred. Please try again.");
      return ctx.scene.leave();
    }
  },
  // Step 4: Update answer
  async (ctx) => {
    logger_service_1.logger.info("Step 4: Update answer");
    try {
      if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === "Back") {
          ctx.wizard.state.editing = false;
          const submission = await prisma.submission.findUnique({
            where: { id: ctx.wizard.state.selectedSubmissionId },
            include: { answers: { include: { question: true } } },
          });
          if (submission) {
            await ctx.reply(
              formatSubmissionDetails(submission, ctx.wizard.state.questions) +
                "\n\nChoose an action:",
              {
                reply_markup: createActionKeyboard().reply_markup,
                parse_mode: "Markdown",
              },
            );
          }
          return ctx.wizard.selectStep(2);
        }
        const { editingQuestion, questions, selectedSubmissionId } =
          ctx.wizard.state;
        const newAnswerText = ctx.message.text;
        const questionToEditId = questions[editingQuestion].id;
        // Find and update the specific answer record in the Answer table
        const updatedAnswer = await prisma.answer.updateMany({
          where: {
            submissionId: selectedSubmissionId,
            questionId: questionToEditId,
          },
          data: {
            answer: newAnswerText,
          },
        });
        // Find and update the submission's updatedAt field
        await prisma.submission.update({
          where: { id: selectedSubmissionId },
          data: { updatedAt: new Date() },
        });
        logger_service_1.logger.info(
          `User ${ctx.from.id} updated submission ${selectedSubmissionId}`,
        );
        // Fetch the updated submission for display
        const updatedSubmission = await prisma.submission.findUnique({
          where: { id: selectedSubmissionId },
          include: { answers: { include: { question: true } } },
        });
        if (updatedSubmission) {
          await ctx.reply(
            "Answer updated!\n\nUpdated answers:\n" +
              formatSubmissionDetails(updatedSubmission, questions) +
              "\n\nChoose an action:",
            {
              reply_markup: createActionKeyboard().reply_markup,
              parse_mode: "Markdown",
            },
          );
        } else {
          await ctx.reply("Error retrieving updated submission.");
          return ctx.scene.leave();
        }
        ctx.wizard.state.editing = false;
        return ctx.wizard.selectStep(2); // Return to action step
      }
      await ctx.reply(
        "Please enter your updated answer.",
        createBackKeyboard(),
      );
      return ctx.wizard.selectStep(4);
    } catch (error) {
      logger_service_1.logger.error("Error updating answer:", error);
      await ctx.reply("An error occurred while updating your answer.");
      return ctx.scene.leave();
    }
  },
);
