import mongoose, { Document, Model, Schema } from 'mongoose';
import { AuditEventType, UserRole } from '../types/cse.js';

export interface IAuditLogModel extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorName?: string;
  actorRole: UserRole;
  eventType: AuditEventType;
  resourceType: 'SESSION' | 'FILE' | 'QUESTION' | 'HINT' | 'TESTCASE' | 'CODE';
  resourceId?: mongoose.Types.ObjectId | string;
  metadata?: Record<string, any>;
  timestamp: number; // Milliseconds since Unix epoch
}

const auditLogSchema = new Schema<IAuditLogModel>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actorName: {
      type: String
    },
    actorRole: {
      type: String,
      enum: ['ADMIN', 'INTERVIEWER', 'CANDIDATE'],
      required: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      enum: ['SESSION', 'FILE', 'QUESTION', 'HINT', 'TESTCASE', 'CODE'],
      required: true
    },
    resourceId: {
      type: Schema.Types.Mixed
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Number,
      required: true,
      default: () => Date.now(),
      index: true
    }
  },
  {
    timestamps: false,
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

// High-performance compound indexes for timeline & actor queries
auditLogSchema.index({ sessionId: 1, timestamp: 1 });
auditLogSchema.index({ actorId: 1, timestamp: 1 });

export const AuditLog: Model<IAuditLogModel> = mongoose.model<IAuditLogModel>(
  'AuditLog',
  auditLogSchema
);
