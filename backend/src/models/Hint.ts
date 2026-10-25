import mongoose, { Document, Model, Schema } from 'mongoose';
import { RevealStatus } from '../types/cse.js';

export interface IHintModel extends Document {
  _id: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  status: RevealStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const hintSchema = new Schema<IHintModel>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
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

export const Hint: Model<IHintModel> = mongoose.model<IHintModel>('Hint', hintSchema);
