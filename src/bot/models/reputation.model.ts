import { Schema, model } from "mongoose";

export interface IReputation {
  userId: number;
  score: number;
}

const reputationSchema = new Schema<IReputation>({
  userId: { type: Number, required: true, unique: true },
  score: { type: Number, default: 0 },
});

export const Reputation = model<IReputation>("Reputation", reputationSchema);
