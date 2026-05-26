import mongoose, { HydratedDocument, Schema } from 'mongoose'

export interface IRegistrationAnswer {
  questionId: string
  label: string
  answer: string
}

export interface IRegistrationParticipant {
  fullName: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  email: string
  phone: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  emergencyContact: string
  profession: string
  team: string
  company: string
  privacyAccepted: boolean
}

export interface IRegistrationSelection {
  groupId: string
  groupName: string
  ticketTypeId: string
  ticketName: string
  batchId: string
  batchName: string
}

export interface IRegistrationHistoryEntry {
  action: 'created' | 'payment_confirmed' | 'receipt_resent' | 'cancelled' | 'refund_processed' | 'email_sent' | 'email_failed'
  actorRole: 'system' | 'customer' | 'event_admin' | 'super_admin'
  actorUserId?: mongoose.Types.ObjectId | null
  description: string
  reason: string
  emailType: string
  refundAmount: number
  refundPercent: number
  stripeRefundId: string
  createdAt: Date
}

export interface IRegistration {
  user: mongoose.Types.ObjectId
  event: mongoose.Types.ObjectId
  orderNumber: string
  buyerType: 'self' | 'third_party'
  status: 'pending_payment' | 'processing_payment' | 'confirmed' | 'payment_failed' | 'cancelled' | 'refunded'
  paymentMethod: 'stripe' | 'pix' | 'credit_card'
  subtotal: number
  feeAmount: number
  totalAmount: number
  stripePaymentIntentId: string
  stripePaymentMethodType: string
  stripeRefundId: string
  paidAt?: Date | null
  cancelledAt?: Date | null
  refundedAt?: Date | null
  cancellationReason: string
  refundAmount: number
  participant: IRegistrationParticipant
  selection: IRegistrationSelection
  additionalAnswers: IRegistrationAnswer[]
  history: IRegistrationHistoryEntry[]
  createdAt: Date
  updatedAt: Date
}

export type RegistrationDocument = HydratedDocument<IRegistration>

const registrationAnswerSchema = new Schema<IRegistrationAnswer>(
  {
    questionId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
)

const registrationParticipantSchema = new Schema<IRegistrationParticipant>(
  {
    fullName: { type: String, required: true, trim: true },
    birthDate: { type: String, trim: true, default: '' },
    gender: { type: String, trim: true, default: '' },
    documentType: { type: String, trim: true, default: 'CPF' },
    document: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    zipCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'Brasil' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    addressLine: { type: String, trim: true, default: '' },
    addressNumber: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    profession: { type: String, trim: true, default: '' },
    team: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    privacyAccepted: { type: Boolean, default: true },
  },
  { _id: false },
)

const registrationSelectionSchema = new Schema<IRegistrationSelection>(
  {
    groupId: { type: String, required: true, trim: true },
    groupName: { type: String, required: true, trim: true },
    ticketTypeId: { type: String, required: true, trim: true },
    ticketName: { type: String, required: true, trim: true },
    batchId: { type: String, required: true, trim: true },
    batchName: { type: String, required: true, trim: true },
  },
  { _id: false },
)

const registrationHistoryEntrySchema = new Schema<IRegistrationHistoryEntry>(
  {
    action: {
      type: String,
      enum: ['created', 'payment_confirmed', 'receipt_resent', 'cancelled', 'refund_processed', 'email_sent', 'email_failed'],
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['system', 'customer', 'event_admin', 'super_admin'],
      required: true,
    },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, required: true, trim: true },
    reason: { type: String, trim: true, default: '' },
    emailType: { type: String, trim: true, default: '' },
    refundAmount: { type: Number, min: 0, default: 0 },
    refundPercent: { type: Number, min: 0, default: 0 },
    stripeRefundId: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const registrationSchema = new Schema<IRegistration>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, trim: true },
    buyerType: {
      type: String,
      enum: ['self', 'third_party'],
      default: 'self',
    },
    status: {
      type: String,
      enum: ['pending_payment', 'processing_payment', 'confirmed', 'payment_failed', 'cancelled', 'refunded'],
      default: 'pending_payment',
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'pix', 'credit_card'],
      default: 'stripe',
    },
    subtotal: { type: Number, required: true, min: 0 },
    feeAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    stripePaymentIntentId: { type: String, trim: true, default: '' },
    stripePaymentMethodType: { type: String, trim: true, default: '' },
    stripeRefundId: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, default: '' },
    refundAmount: { type: Number, min: 0, default: 0 },
    participant: { type: registrationParticipantSchema, required: true },
    selection: { type: registrationSelectionSchema, required: true },
    additionalAnswers: { type: [registrationAnswerSchema], default: [] },
    history: { type: [registrationHistoryEntrySchema], default: [] },
  },
  {
    timestamps: true,
  },
)

export const Registration = mongoose.model<IRegistration>('Registration', registrationSchema)