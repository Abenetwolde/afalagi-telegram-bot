import { Scenes, Markup } from 'telegraf';
import { Submission } from '../models/submission.model';
import { User } from '../models/user.model';
import { logger } from '../services/logger.service';
import { IBotContext } from '../../types';
import { SceneContextScene, WizardScene } from 'telegraf/typings/scenes';
const questions = [
  { key: 'name', text: 'Please enter your name' },
  { key: 'phoneNumber', text: 'Please enter your full phone number', confidential: true },
  { key: 'birthYear', text: 'Please enter your birth year' },
  { key: 'age', text: 'Please enter your age' },
  { key: 'skinColor', text: 'Please enter your skin color' },
  { key: 'appearance', text: 'Please describe your appearance/beauty' },
  { key: 'height', text: 'Please enter your height' },
  { key: 'weight', text: 'Please enter your weight' },
  { key: 'healthStatus', text: 'Please describe your health status' },
  { key: 'religion', text: 'Please enter your religion' },
  { key: 'religiousEducation', text: 'Please describe your religious education' },
  { key: 'languages', text: 'Please list languages you speak fluently' },
  { key: 'previousMarriage', text: 'Have you been married before?' },
  { key: 'children', text: 'Do you have children?' },
  { key: 'occupation', text: 'What is your occupation?' },
  { key: 'monthlyIncome', text: 'What is your monthly income?', confidential: true },
  { key: 'birthPlace', text: 'Where were you born?' },
  { key: 'currentResidence', text: 'Where do you currently live?' },
  { key: 'housing', text: 'Describe your housing situation' },
  { key: 'desiredResidence', text: 'Where do you want to live?' },
  { key: 'education', text: 'What is your education level?' },
  { key: 'partnerPreferences', text: 'What are you looking for in a partner?' },
];

const partnerQuestions = [
  { key: 'partnerAge', text: 'Preferred partner age?' },
  { key: 'partnerSkinColor', text: 'Preferred partner skin color?' },
  { key: 'partnerAppearance', text: 'Preferred partner appearance?' },
  { key: 'partnerHeight', text: 'Preferred partner height?' },
  { key: 'partnerWeight', text: 'Preferred partner weight?' },
  { key: 'partnerEducation', text: 'Preferred partner education level?' },
  { key: 'partnerReligiousEducation', text: 'Preferred partner religious education?' },
  { key: 'partnerOccupation', text: 'Preferred partner occupation?' },
  { key: 'partnerMonthlyIncome', text: 'Preferred partner monthly income?', confidential: true },
  { key: 'partnerPreviousMarriage', text: 'Preferred partner previous marriage status?' },
  { key: 'partnerCurrentMarriage', text: 'Preferred partner current marriage status?' },
  { key: 'partnerChildren', text: 'Preferred partner children status?' },
  { key: 'partnerHousing', text: 'Preferred partner housing situation?' },
];

export const questionnaireScene = new Scenes.WizardScene<any>(
  'questionnaire',
  ...[...questions, ...partnerQuestions].map((q, index) => async (ctx:any) => {
    ctx.wizard.state.answers = ctx.wizard.state.answers || {};
    await ctx.reply(q.text, Markup.keyboard(['Skip']).oneTime());
    ctx.wizard.state.currentQuestion = index;
    return ctx.wizard.next();
  }),
  async (ctx) => {
    const index = ctx.wizard.state.currentQuestion;
    const question = [...questions, ...partnerQuestions][index];
    if (ctx.message && 'text' in ctx.message && ctx.message.text !== 'Skip') {
      ctx.wizard.state.answers[question.key] = ctx.message.text;
    }
    if (index < questions.length + partnerQuestions.length - 1) {
      return ctx.wizard.selectStep(index + 1);
    }

    const submission = new Submission({
      userId: ctx.from!.id,
      answers: ctx.wizard.state.answers,
      status: 'pending',
    });
    await submission.save();
    await ctx.reply(
      'Submission saved! Preview your answers:\n' +
      Object.entries(ctx.wizard.state.answers)
        .filter(([key]) => !questions.find(q => q.key === key)?.confidential)
        .map(([key, value]) => `${key}: ${value}`).join('\n'),
      Markup.inlineKeyboard([
        Markup.button.callback('Submit', 'submit'),
        Markup.button.callback('Edit', 'edit'),
      ])
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      if (ctx.callbackQuery.data === 'submit') {
        await ctx.reply('Submission sent for review!');
        return ctx.scene.leave();
      }
      if (ctx.callbackQuery.data === 'edit') {
        await ctx.reply('Which question would you like to edit?', Markup.keyboard(
          [...questions, ...partnerQuestions].map(q => q.text)
        ).oneTime());
        ctx.wizard.state.editing = true;
        return ctx.wizard.next();
      }
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      const questionIndex = [...questions, ...partnerQuestions].findIndex(q => q.text === ctx.message.text);
      if (questionIndex >= 0) {
        ctx.wizard.state.currentQuestion = questionIndex;
        await ctx.reply([...questions, ...partnerQuestions][questionIndex].text);
        ctx.wizard.state.editingQuestion = questionIndex;
        return ctx.wizard.next();
      }
    }
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      const question = [...questions, ...partnerQuestions][ctx.wizard.state.editingQuestion];
      ctx.wizard.state.answers[question.key] = ctx.message.text;
      await ctx.reply('Answer updated! Submit or continue editing.', Markup.inlineKeyboard([
        Markup.button.callback('Submit', 'submit'),
        Markup.button.callback('Edit another', 'edit'),
      ]));
      return ctx.wizard.selectStep(ctx.wizard.state.currentQuestion + 2);
    }
  }
);