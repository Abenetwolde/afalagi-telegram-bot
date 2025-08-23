"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminScene = void 0;
const telegraf_1 = require("telegraf");
const submission_model_1 = require("../models/submission.model");
const user_model_1 = require("../models/user.model");
const question_model_1 = require("../models/question.model");
const logger_service_1 = require("../services/logger.service");
// Admin Scene
exports.adminScene = new telegraf_1.Scenes.WizardScene("admin", 
// Step 0: Main menu
async (ctx) => {
    if (!ctx.wizard.state.newQuestion) {
        ctx.wizard.state.newQuestion = {};
    }
    console.log("Admin Scene - Step 0: Main menu");
    try {
        const user = await user_model_1.User.findOne({ telegramId: ctx.from.id });
        if (!user || !user.isAdmin) {
            await ctx.reply("Access denied. You are not an admin.");
            return ctx.scene.leave();
        }
        await ctx.reply("Admin Panel: Choose an option:", telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback("View New Users", "view_users")],
            [
                telegraf_1.Markup.button.callback("View Recent Applications", "view_applications"),
            ],
            [telegraf_1.Markup.button.callback("Add Question", "add_question")],
        ]));
        return ctx.wizard.selectStep(1);
    }
    catch (error) {
        logger_service_1.logger.error("Error in admin scene main menu:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 1: View new registered users
async (ctx) => {
    console.log("Admin Scene - Step 1: View new users");
    try {
        if (ctx.callbackQuery &&
            "data" in ctx.callbackQuery &&
            ctx.callbackQuery.data === "view_users") {
            const users = await user_model_1.User.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate({
                path: "lastSubmissionId",
                populate: { path: "answers.questionId" },
            });
            if (users.length === 0) {
                await ctx.reply("No new users found.");
                return ctx.wizard.selectStep(0);
            }
            let message = "Newly Registered Users:\n";
            for (const user of users) {
                const lastSubmission = user.lastSubmissionId; // or
                const nameAnswer = lastSubmission?.answers.find((a) => a.questionId.key === "name")?.answer || "Unknown";
                const profileLink = user.username
                    ? `[${nameAnswer}](https://t.me/${user.username.replace("@", "")})`
                    : nameAnswer;
                message += `- ${profileLink} (Registered: ${user.createdAt.toLocaleDateString()})\n`;
            }
            await ctx.reply(message, {
                parse_mode: "Markdown",
                reply_markup: telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback("Back to Menu", "back_to_menu")],
                ]).reply_markup,
            });
            return ctx.wizard.selectStep(1);
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in view new users step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 2: View recent applications
async (ctx) => {
    console.log("Admin Scene - Step 2: View recent applications");
    try {
        if (ctx.callbackQuery &&
            "data" in ctx.callbackQuery &&
            ctx.callbackQuery.data === "view_applications") {
            const submissions = await submission_model_1.Submission.find({ status: "pending" })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate("answers.questionId");
            if (submissions.length === 0) {
                await ctx.reply("No pending applications found.");
                return ctx.wizard.selectStep(0);
            }
            let message = "Recent Applications:\n";
            for (const submission of submissions) {
                const user = await user_model_1.User.findOne({ telegramId: submission.userId });
                const nameAnswer = submission.answers.find((a) => a.questionId.key === "name")
                    ?.answer || "Unknown";
                message += `- ${nameAnswer} (Submitted: ${submission.createdAt.toLocaleDateString()} ${submission.createdAt.toLocaleTimeString()}) [View More](view_${submission._id})\n`;
            }
            await ctx.reply(message, {
                parse_mode: "Markdown",
                reply_markup: telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback("Back to Menu", "back_to_menu")],
                ]).reply_markup,
            });
            // Register dynamic action handlers for View More buttons
            submissions.forEach((submission) => {
                ctx.scene.session.actionHandler = ctx.scene.action(`view_${submission._id}`, async (ctx) => {
                    console.log(`Viewing submission ${submission._id}`);
                    const user = await user_model_1.User.findOne({
                        telegramId: submission.userId,
                    });
                    let details = `Submission ID: ${submission._id}\n`;
                    details += `User: ${user?.username || "Unknown"}\n`;
                    details += `Status: ${submission.status}\n`;
                    details += `Submitted: ${submission.createdAt.toLocaleDateString()} ${submission.createdAt.toLocaleTimeString()}\n\nAnswers:\n`;
                    submission.answers.forEach((a, index) => {
                        details += `${index + 1}. ${a.questionId.text}\n${a.answer}\n`;
                    });
                    await ctx.reply(details, {
                        reply_markup: telegraf_1.Markup.inlineKeyboard([
                            [
                                telegraf_1.Markup.button.callback("Approve", `approve_${submission._id}`),
                            ],
                            [
                                telegraf_1.Markup.button.callback("Reject", `reject_${submission._id}`),
                            ],
                            [
                                telegraf_1.Markup.button.callback("Back to Applications", "view_applications"),
                            ],
                        ]).reply_markup,
                        parse_mode: "Markdown",
                    });
                    return ctx.wizard.selectStep(3);
                });
            });
            return ctx.wizard.selectStep(2);
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in view applications step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 3: Handle approve/reject
async (ctx) => {
    console.log("Admin Scene - Step 3: Handle approve/reject");
    try {
        if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data.startsWith("approve_") || data.startsWith("reject_")) {
                const submissionId = data.split("_")[1];
                const newStatus = data.startsWith("approve_")
                    ? "approved"
                    : "rejected";
                console.log(`Updating submission ${submissionId} to status: ${newStatus}`);
                await submission_model_1.Submission.updateOne({ _id: submissionId }, { $set: { status: newStatus, updatedAt: new Date() } });
                await ctx.reply(`Submission ${newStatus}!`);
                await ctx.reply("Choose an option:", telegraf_1.Markup.inlineKeyboard([
                    [
                        telegraf_1.Markup.button.callback("View Recent Applications", "view_applications"),
                    ],
                    [telegraf_1.Markup.button.callback("Back to Menu", "back_to_menu")],
                ]));
                return ctx.wizard.selectStep(2);
            }
            if (data === "view_applications") {
                return ctx.wizard.selectStep(2);
            }
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in approve/reject step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 4: Add question - Enter key
async (ctx) => {
    console.log("Admin Scene - Step 4: Add question - Enter key");
    try {
        if (ctx.callbackQuery &&
            "data" in ctx.callbackQuery &&
            ctx.callbackQuery.data === "add_question") {
            await ctx.reply("Enter the unique key for the new question:");
            return ctx.wizard.selectStep(4);
        }
        if (ctx.message && "text" in ctx.message) {
            const key = ctx.message.text.trim();
            if (await question_model_1.Question.findOne({ key })) {
                await ctx.reply("This key already exists. Please enter a unique key:");
                return ctx.wizard.selectStep(4);
            }
            ctx.wizard.state.newQuestion = { key };
            await ctx.reply("Enter the question text:");
            return ctx.wizard.selectStep(5);
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in add question key step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 5: Add question - Enter text and category
async (ctx) => {
    console.log("Admin Scene - Step 5: Add question - Enter text and category");
    try {
        if (ctx.message && "text" in ctx.message) {
            ctx.wizard.state.newQuestion.text = ctx.message.text.trim();
            await ctx.reply("Select the question category:", telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback("Personal", "category_personal")],
                [telegraf_1.Markup.button.callback("Partner", "category_partner")],
            ]));
            return ctx.wizard.selectStep(5);
        }
        if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
            const category = ctx.callbackQuery.data === "category_personal"
                ? "personal"
                : "partner";
            ctx.wizard.state.newQuestion.category = category;
            await ctx.reply("Is this question confidential?", telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback("Yes", "confidential_true")],
                [telegraf_1.Markup.button.callback("No", "confidential_false")],
            ]));
            return ctx.wizard.selectStep(6);
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in add question text/category step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
}, 
// Step 6: Add question - Save question
async (ctx) => {
    console.log("Admin Scene - Step 6: Add question - Save");
    try {
        if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
            const confidential = ctx.callbackQuery.data === "confidential_true";
            ctx.wizard.state.newQuestion.confidential = confidential;
            const question = new question_model_1.Question({
                key: ctx.wizard.state.newQuestion.key,
                text: ctx.wizard.state.newQuestion.text,
                confidential,
                category: ctx.wizard.state.newQuestion.category,
            });
            await question.save();
            console.log("Question saved with key:", question.key);
            await ctx.reply("Question added successfully!");
            await ctx.reply("Admin Panel: Choose an option:", telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback("View New Users", "view_users")],
                [
                    telegraf_1.Markup.button.callback("View Recent Applications", "view_applications"),
                ],
                [telegraf_1.Markup.button.callback("Add Question", "add_question")],
            ]));
            return ctx.wizard.selectStep(0);
        }
        return ctx.wizard.selectStep(0);
    }
    catch (error) {
        logger_service_1.logger.error("Error in save question step:", error);
        await ctx.reply("An error occurred. Please try again.");
        return ctx.scene.leave();
    }
});
// Handle Back to Menu
exports.adminScene.action("back_to_menu", async (ctx) => {
    console.log("Back to admin menu");
    await ctx.reply("Admin Panel: Choose an option:", telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("View New Users", "view_users")],
        [telegraf_1.Markup.button.callback("View Recent Applications", "view_applications")],
        [telegraf_1.Markup.button.callback("Add Question", "add_question")],
    ]));
    return ctx.wizard.selectStep(0);
});
