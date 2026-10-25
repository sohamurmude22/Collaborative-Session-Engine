import mongoose, { Document, Model, Schema } from 'mongoose';
import { UserRole } from '../types/cse.js';

export interface ISessionParticipantModel extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: UserRole;
  status: 'ONLINE' | 'OFFLINE';
  isBlocked?: boolean;
  blockedReason?: string;
  joinedAt: Date;
  leftAt?: Date;
  lastSeen: number;
}

const sessionParticipantSchema = new Schema<ISessionParticipantModel>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['ADMIN', 'INTERVIEWER', 'CANDIDATE'],
      required: true
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE'
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedReason: {
      type: String,
      default: ''
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date
    },
    lastSeen: {
      type: Number,
      default: () => Date.now()
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

sessionParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const SessionParticipant: Model<ISessionParticipantModel> =
  mongoose.model<ISessionParticipantModel>('SessionParticipant', sessionParticipantSchema);
