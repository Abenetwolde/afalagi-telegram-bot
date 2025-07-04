import { Schema, model } from 'mongoose';

export interface IUser {
  telegramId: number;
  username?: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>('User', userSchema);