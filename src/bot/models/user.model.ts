import { Schema, model } from 'mongoose';

export interface IUser {
  telegramId: number;
  username?: string;
  createdAt: Date;
  lastSubmissionId?: Schema.Types.ObjectId; // Reference to the latest submission for quick access
}

const userSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastSubmissionId: { type: Schema.Types.ObjectId, ref: 'Submission' },
});

export const User = model<IUser>('User', userSchema);