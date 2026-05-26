import bcrypt from 'bcryptjs'
import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'

import { roleList, roles, type Role } from '../constants/roles.js'

export interface IUser {
  name: string
  email: string
  username?: string
  password: string
  termsAcceptedAt: Date | null
  privacyPolicyAcceptedAt: Date | null
  lgpdConsentAcceptedAt: Date | null
  emailVerifiedAt: Date | null
  emailVerificationTokenHash: string
  emailVerificationExpiresAt: Date | null
  passwordResetTokenHash: string
  passwordResetExpiresAt: Date | null
  role: Role
  platformFeePercent: number
  phone: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  createdAt: Date
  updatedAt: Date
}

export interface PublicUser {
  id: string
  name: string
  email: string
  username?: string
  isEmailVerified: boolean
  role: Role
  platformFeePercent: number
  phone: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  createdAt: Date
}

export interface UserMethods {
  comparePassword(password: string): Promise<boolean>
  toPublicJSON(): PublicUser
}

export type UserDocument = HydratedDocument<IUser, UserMethods>
type UserModel = Model<IUser, object, UserMethods>

const userSchema = new Schema<IUser, UserModel, UserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    privacyPolicyAcceptedAt: {
      type: Date,
      default: null,
    },
    lgpdConsentAcceptedAt: {
      type: Date,
      default: null,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationTokenHash: {
      type: String,
      trim: true,
      default: '',
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },
    passwordResetTokenHash: {
      type: String,
      trim: true,
      default: '',
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: roleList,
      default: roles.customer,
    },
    platformFeePercent: {
      type: Number,
      min: 0,
      default: 0,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    birthDate: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      trim: true,
      default: '',
    },
    documentType: {
      type: String,
      trim: true,
      default: 'CPF',
    },
    document: {
      type: String,
      trim: true,
      default: '',
    },
    zipCode: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'Brasil',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine: {
      type: String,
      trim: true,
      default: '',
    },
    addressNumber: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

userSchema.pre('save', async function savePassword(next) {
  if (!this.isModified('password')) {
    next()
    return
  }

  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.method('comparePassword', function comparePassword(password: string) {
  return bcrypt.compare(password, this.password)
})

userSchema.method('toPublicJSON', function toPublicJSON(): PublicUser {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    username: this.username,
    isEmailVerified: Boolean(this.emailVerifiedAt),
    role: this.role,
    platformFeePercent: this.platformFeePercent,
    phone: this.phone,
    birthDate: this.birthDate,
    gender: this.gender,
    documentType: this.documentType,
    document: this.document,
    zipCode: this.zipCode,
    country: this.country,
    state: this.state,
    city: this.city,
    addressLine: this.addressLine,
    addressNumber: this.addressNumber,
    createdAt: this.createdAt,
  }
})

export const User = mongoose.model<IUser, UserModel>('User', userSchema)