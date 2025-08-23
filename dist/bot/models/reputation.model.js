"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reputation = void 0;
const mongoose_1 = require("mongoose");
const reputationSchema = new mongoose_1.Schema({
  userId: { type: Number, required: true, unique: true },
  score: { type: Number, default: 0 },
});
exports.Reputation = (0, mongoose_1.model)("Reputation", reputationSchema);
