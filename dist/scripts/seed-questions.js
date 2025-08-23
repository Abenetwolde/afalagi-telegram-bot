"use strict";
const { PrismaClient } = require("@prisma/client");
// const { logger } = require('../../../bot/services/logger.service');
const prisma = new PrismaClient();
const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("Connected to PostgreSQL via Prisma");
    }
    catch (err) {
        console.error("DB connection error:", err);
        process.exit(1);
    }
};
const questions = [
    {
        key: "name",
        text: "Please enter your name",
        confidential: false,
        category: "personal",
    },
    // { key: 'phoneNumber', text: 'Please enter your full phone number', confidential: true, category: 'personal' },
    // { key: 'birthYear', text: 'Please enter your birth year', confidential: false, category: 'personal' },
    // { key: 'age', text: 'Please enter your age', confidential: false, category: 'personal' },
    // { key: 'skinColor', text: 'Please enter your skin color', confidential: false, category: 'personal' },
    // { key: 'appearance', text: 'Please describe your appearance/beauty', confidential: false, category: 'personal' },
    // { key: 'height', text: 'Please enter your height', confidential: false, category: 'personal' },
    // { key: 'weight', text: 'Please enter your weight', confidential: false, category: 'personal' },
    // { key: 'healthStatus', text: 'Please describe your health status', confidential: false, category: 'personal' },
    // { key: 'religion', text: 'Please enter your religion', confidential: false, category: 'personal' },
    // { key: 'religiousEducation', text: 'Please describe your religious education', confidential: false, category: 'personal' },
    // { key: 'languages', text: 'Please list languages you speak fluently', confidential: false, category: 'personal' },
    // { key: 'previousMarriage', text: 'Have you been married before?', confidential: false, category: 'personal' },
    // { key: 'children', text: 'Do you have children?', confidential: false, category: 'personal' },
    // { key: 'occupation', text: 'What is your occupation?', confidential: false, category: 'personal' },
    // { key: 'monthlyIncome', text: 'What is your monthly income?', confidential: true, category: 'personal' },
    // { key: 'birthPlace', text: 'Where were you born?', confidential: false, category: 'personal' },
    // { key: 'currentResidence', text: 'Where do you currently live?', confidential: false, category: 'personal' },
    // { key: 'housing', text: 'Describe your housing situation', confidential: false, category: 'personal' },
    // { key: 'desiredResidence', text: 'Where do you want to live?', confidential: false, category: 'personal' },
    // { key: 'education', text: 'What is your education level?', confidential: false, category: 'personal' },
    // { key: 'partnerPreferences', text: 'What are you looking for in a partner?', confidential: false, category: 'personal' },
    {
        key: "partnerAge",
        text: "Preferred partner age?",
        confidential: false,
        category: "partner",
    },
    // { key: 'partnerSkinColor', text: 'Preferred partner skin color?', confidential: false, category: 'partner' },
    // { key: 'partnerAppearance', text: 'Preferred partner appearance?', confidential: false, category: 'partner' },
    // { key: 'partnerHeight', text: 'Preferred partner height?', confidential: false, category: 'partner' },
    // { key: 'partnerWeight', text: 'Preferred partner weight?', confidential: false, category: 'partner' },
    // { key: 'partnerEducation', text: 'Preferred partner education level?', confidential: false, category: 'partner' },
    // { key: 'partnerReligiousEducation', text: 'Preferred partner religious education?', confidential: false, category: 'partner' },
    // { key: 'partnerOccupation', text: 'Preferred partner occupation?', confidential: false, category: 'partner' },
    // { key: 'partnerMonthlyIncome', text: 'Preferred partner monthly income?', confidential: true, category: 'partner' },
    // { key: 'partnerPreviousMarriage', text: 'Preferred partner previous marriage status?', confidential: false, category: 'partner' },
    // { key: 'partnerCurrentMarriage', text: 'Preferred partner current marriage status?', confidential: false, category: 'partner' },
    // { key: 'partnerChildren', text: 'Preferred partner children status?', confidential: false, category: 'partner' },
    // { key: 'partnerHousing', text: 'Preferred partner housing situation?', confidential: false, category: 'partner' },
];
async function seedQuestions() {
    try {
        // Connect to the database using the provided function.
        await connectDB();
        // 1. Delete all related Answer records first to satisfy the foreign key constraint.
        const deleteAnswers = await prisma.answer.deleteMany({});
        console.log(`Deleted ${deleteAnswers.count} existing answers.`);
        // 2. Then, you can safely delete the Submission records that might exist.
        const deleteSubmissions = await prisma.submission.deleteMany({});
        console.log(`Deleted ${deleteSubmissions.count} existing submissions.`);
        // 3. Now, you can delete the Question records.
        const deleteQuestions = await prisma.question.deleteMany({});
        console.log(`Deleted ${deleteQuestions.count} existing questions.`);
        // 4. Finally, seed the new questions.
        const createResult = await prisma.question.createMany({
            data: questions,
        });
        console.log(`Seeded ${createResult.count} questions successfully.`);
    }
    catch (error) {
        // Log a more descriptive error message.
        console.error(`Error seeding questions: ${error}`);
    }
    finally {
        // Disconnect from the database to prevent the script from hanging.
        await prisma.$disconnect();
    }
}
// Execute the seeding function.
seedQuestions();
