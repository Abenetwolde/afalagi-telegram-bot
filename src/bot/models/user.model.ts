import { Schema, model } from "mongoose";

export interface IUser {
  telegramId: number;
  username?: string;
  createdAt: Date;
  isAdmin?: boolean; // Optional field to indicate if the user is an admin
  lastSubmissionId?: Schema.Types.ObjectId; // Reference to the latest submission for quick access
}

const userSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastSubmissionId: { type: Schema.Types.ObjectId, ref: "Submission" },
});

export const User = model<IUser>("User", userSchema);
