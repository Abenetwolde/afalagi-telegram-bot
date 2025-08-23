import { Schema, model } from "mongoose";

export interface ISubmission {
  userId: number;
  answers: { questionId: Schema.Types.ObjectId; answer: string }[];
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>({
  userId: { type: Number, required: true },
  answers: [
    {
      questionId: {
        type: Schema.Types.ObjectId,
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

export const Submission = model<ISubmission>("Submission", submissionSchema);
