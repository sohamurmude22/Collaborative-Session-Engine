import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOrganizationModel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganizationModel>(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

export const Organization: Model<IOrganizationModel> = mongoose.model<IOrganizationModel>(
  'Organization',
  organizationSchema
);
