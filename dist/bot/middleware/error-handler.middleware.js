"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerMiddleware = errorHandlerMiddleware;
const logger_service_1 = require("../services/logger.service");
async function errorHandlerMiddleware(ctx, next) {
    try {
        await next();
    }
    catch (err) {
        logger_service_1.logger.error(`Error: ${err.message}`);
        await ctx.reply('Something went wrong. Please try again later.');
    }
}
