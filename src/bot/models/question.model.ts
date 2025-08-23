import { Schema, model } from "mongoose";

export interface IQuestion {
  key: string;
  text: string;
  confidential?: boolean;
  category: "personal" | "partner"; // To distinguish personal vs partner questions
}

const questionSchema = new Schema<IQuestion>({
  key: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  confidential: { type: Boolean, default: false },
  category: { type: String, enum: ["personal", "partner"], required: true },
});

export const Question = model<IQuestion>("Question", questionSchema);
