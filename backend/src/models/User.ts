import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { UserRole } from '../types/cse.js';

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%236366F1'/%3E%3Ccircle cx='64' cy='48' r='22' fill='%23FFFFFF'/%3E%3Cpath d='M28 106c0-19.88 16.12-36 36-36s36 16.12 36 36' fill='%23FFFFFF'/%3E%3C/svg%3E";

export interface IUserModel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId?: mongoose.Types.ObjectId;
  dob?: string;
  interests?: string[];
  friends?: (mongoose.Types.ObjectId | IUserModel)[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },
    role: {
      type: String,
      enum: ['ADMIN', 'INTERVIEWER', 'CANDIDATE'],
      default: 'CANDIDATE'
    },
    avatarUrl: {
      type: String,
      default: DEFAULT_AVATAR
    },
    dob: {
      type: String,
      default: ''
    },
    interests: {
      type: [String],
      default: []
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization'
    },
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      }
    }
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: unknown) {
    next(err as Error);
  }
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: Model<IUserModel> = mongoose.model<IUserModel>('User', userSchema);
