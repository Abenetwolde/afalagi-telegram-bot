"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    telegramId: { type: Number, required: true, unique: true },
    username: { type: String },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastSubmissionId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Submission" },
});
exports.User = (0, mongoose_1.model)("User", userSchema);
