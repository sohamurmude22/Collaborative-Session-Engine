import mongoose, { Document, Model, Schema } from 'mongoose';
import { RevealStatus } from '../types/cse.js';

export interface ITestCaseModel extends Document {
  _id: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  status: RevealStatus;
  createdAt: Date;
  updatedAt: Date;
}

const testCaseSchema = new Schema<ITestCaseModel>(
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
    input: {
      type: String,
      default: ''
    },
    expectedOutput: {
      type: String,
      default: ''
    },
    isSample: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['HIDDEN', 'REVEALED'],
      default: 'HIDDEN'
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

export const TestCase: Model<ITestCaseModel> = mongoose.model<ITestCaseModel>(
  'TestCase',
  testCaseSchema
);
