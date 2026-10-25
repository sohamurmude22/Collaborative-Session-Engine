import mongoose, { Document, Model, Schema } from 'mongoose';
import { FilePermission, ProgrammingLanguage } from '../types/cse.js';

export interface IFileModel extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  name: string;
  language: ProgrammingLanguage;
  content: string;
  permission: FilePermission;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFileModel>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    language: {
      type: String,
      enum: ['cpp', 'python', 'javascript', 'typescript'],
      default: 'cpp'
    },
    content: {
      type: String,
      default: ''
    },
    permission: {
      type: String,
      enum: ['VISIBLE_EDITABLE', 'VISIBLE_READONLY', 'LOCKED', 'HIDDEN'],
      default: 'VISIBLE_EDITABLE'
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

// Compound index for uniqueness per session
fileSchema.index({ sessionId: 1, name: 1 }, { unique: true });

export const File: Model<IFileModel> = mongoose.model<IFileModel>('File', fileSchema);
