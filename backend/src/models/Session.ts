import mongoose, { Document, Model, Schema } from 'mongoose';
import { SessionStatus } from '../types/cse.js';

export interface ISessionModel extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  interviewerId: mongoose.Types.ObjectId;
  candidateId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  status: SessionStatus;
  sessionCode: string;
  isScreenLocked?: boolean;
  screenLockedReason?: string;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISessionModel>(
  {
    title: {
      type: String,
      required: [true, 'Session title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    interviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    },
    status: {
      type: String,
      enum: ['CREATED', 'WAITING', 'ACTIVE', 'PAUSED', 'COMPLETED'],
      default: 'ACTIVE'
    },
    isScreenLocked: {
      type: Boolean,
      default: false
    },
    screenLockedReason: {
      type: String,
      default: ''
    },
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    startedAt: {
      type: Date
    },
    endedAt: {
      type: Date
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

export const Session: Model<ISessionModel> = mongoose.model<ISessionModel>('Session', sessionSchema);
