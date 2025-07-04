import { Schema, model } from 'mongoose';

export interface ISubmission {
  userId: number;
  answers: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

const submissionSchema = new Schema<ISubmission>({
  userId: { type: Number, required: true },
  answers: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

export const Submission = model<ISubmission>('Submission', submissionSchema);