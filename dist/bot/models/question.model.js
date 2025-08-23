"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Question = void 0;
const mongoose_1 = require("mongoose");
const questionSchema = new mongoose_1.Schema({
  key: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  confidential: { type: Boolean, default: false },
  category: { type: String, enum: ["personal", "partner"], required: true },
});
exports.Question = (0, mongoose_1.model)("Question", questionSchema);
