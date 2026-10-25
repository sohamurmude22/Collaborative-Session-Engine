import mongoose, { Document, Model, Schema } from 'mongoose';
import { RevealStatus } from '../types/cse.js';

export interface IQuestionModel extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: RevealStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestionModel>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Question title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: ['HIDDEN', 'REVEALED'],
      default: 'HIDDEN'
    },
    order: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Question: Model<IQuestionModel> = mongoose.model<IQuestionModel>('Question', questionSchema);
