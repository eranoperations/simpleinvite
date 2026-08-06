import mongoose, { Schema, type Model } from 'mongoose'

export interface IUser {
  _id: mongoose.Types.ObjectId
  email: string
  name?: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
)

// The hash must never ride along in an API response.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as Partial<IUser>).passwordHash
    return ret
  },
})

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema)
