import mongoose from 'mongoose';
import { Question } from '../bot/models/question.model';
import { logger } from '../bot/services/logger.service';
import { connectDB } from '../bot/services/database.service';
import { MONGODB_URI } from '../bot/config/config';

const questions = [
    { key: 'name', text: 'Please enter your name', confidential: false, category: 'personal' },
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
    // { key: 'partnerAge', text: 'Preferred partner age?', confidential: false, category: 'partner' },
    { key: 'partnerSkinColor', text: 'Preferred partner skin color?', confidential: false, category: 'partner' },
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
        console.log("database url", MONGODB_URI);
        await connectDB();
        try {
            await Question.deleteMany({});
            try {
                const existingQuestions = await Question.find({});
                if (existingQuestions.length > 0) {
                    logger.info('Questions already exist, skipping seed');
                    return;
                }
            } catch (error: any) {
                logger.error(`Error checking existing questions: ${error.message}`);
                return;
            }
            await Question.insertMany(questions);
            logger.info('Questions seeded successfully')
        } catch (error: any) {
            logger.error(`Error connecting to MongoDB: ${error.message}`);
            return;

        }
        ;
    } catch (err: any) {
        logger.error(`Error seeding questions: ${err.message}`);
    } finally {
        await mongoose.connection.close();
    }
}

seedQuestions();