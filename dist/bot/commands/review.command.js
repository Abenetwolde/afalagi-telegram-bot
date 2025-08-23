"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewCommand = reviewCommand;
const telegraf_1 = require("telegraf");
const submission_model_1 = require("../models/submission.model");
const user_model_1 = require("../models/user.model");
async function reviewCommand(ctx) {
  const user = await user_model_1.User.findOne({ telegramId: ctx.from.id });
  if (!user?.lastSubmissionId) {
    await ctx.reply(
      "No previous submission found. Start a new one with /start.",
    );
    return;
  }
  const submission = await submission_model_1.Submission.findById(
    user.lastSubmissionId,
  ).populate("answers.questionId");
  if (submission) {
    await ctx.reply(
      "Your previous answers:\n" +
        submission.answers
          .filter((a) => !a.questionId.confidential)
          .map((a) => `${a.questionId.text}: ${a.answer}`)
          .join("\n"),
      telegraf_1.Markup.inlineKeyboard([
        telegraf_1.Markup.button.callback("Edit", "edit"),
        telegraf_1.Markup.button.callback("Submit", "submit"),
      ]),
    );
    ctx.session.answers = submission.answers;
    await ctx.scene.enter("questionnaire", { step: 3 }); // Jump to edit/submit step
  }
}
