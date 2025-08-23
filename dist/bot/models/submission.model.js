"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Submission = void 0;
const mongoose_1 = require("mongoose");
const submissionSchema = new mongoose_1.Schema({
    userId: { type: Number, required: true },
    answers: [
        {
            questionId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Question",
                required: true,
            },
            answer: { type: String, required: true },
        },
    ],
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
submissionSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});
exports.Submission = (0, mongoose_1.model)("Submission", submissionSchema);
