import mongoose, { HydratedDocument, Schema } from 'mongoose'

export interface IEventBatch {
  _id?: mongoose.Types.ObjectId
  name: string
  startAt: Date
  endAt: Date
  price: number
  quantity: number
  status: 'scheduled' | 'active' | 'closed'
}

export interface IEventAdditionalQuestion {
  _id?: mongoose.Types.ObjectId
  label: string
  type: 'text' | 'select' | 'checkbox' | 'number'
  required: boolean
  helperText: string
  placeholder: string
  options: string[]
}

export interface IEventTicketType {
  _id?: mongoose.Types.ObjectId
  groupId: string
  groupName: string
  name: string
  description: string
  price: number
  fee: number
  quantity: number
  sold: number
  additionalQuestions: IEventAdditionalQuestion[]
  batches: IEventBatch[]
}

export interface IEventOrganizer {
  name: string
  contactEmail: string
  contactPhone: string
}

export interface IEventOperationalDetails {
  regulationUrl: string
  checkInNotes: string
  cancellationPolicy: string
  cancellationPolicySettings: {
    fullRefundHoursBeforeEvent: number
    partialRefundHoursBeforeEvent: number
    partialRefundPercent: number
  }
  kitSummary: string
  additionalQuestions: string
}

export interface IEventPageSections {
  aboutEvent: string
  routes: string
  registrations: string
  kitDelivery: string
  awards: string
  schedule: string
  regulation: string
  stravaRoutes: IEventStravaRoute[]
  stravaEmbedUrl: string
}

export interface IEventStravaRoute {
  title: string
  url: string
  embedCode: string
}

export interface IEvent {
  title: string
  slug: string
  category: 'running' | 'triathlon' | 'fight' | 'cycling' | 'fitness' | 'other'
  description: string
  contentHtml: string
  zipCode: string
  city: string
  state: string
  country: string
  venue: string
  addressLine: string
  addressNumber: string
  mapUrl: string
  coverImage: string
  startDate: Date
  endDate: Date
  status: 'draft' | 'published' | 'closed'
  organizer: IEventOrganizer
  operationalDetails: IEventOperationalDetails
  pageSections: IEventPageSections
  ticketTypes: IEventTicketType[]
  createdBy: mongoose.Types.ObjectId
  managedBy: mongoose.Types.ObjectId
  highlights: string[]
  createdAt: Date
  updatedAt: Date
}

export type EventDocument = HydratedDocument<IEvent>

const batchSchema = new Schema<IEventBatch>(
  {
    name: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'closed'],
      default: 'scheduled',
    },
  },
  { _id: true },
)

const additionalQuestionSchema = new Schema<IEventAdditionalQuestion>(
  {
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'select', 'checkbox', 'number'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    helperText: { type: String, trim: true, default: '' },
    placeholder: { type: String, trim: true, default: '' },
    options: { type: [String], default: [] },
  },
  { _id: true },
)

const ticketTypeSchema = new Schema<IEventTicketType>(
  {
    groupId: { type: String, required: true, trim: true },
    groupName: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    price: { type: Number, required: true, min: 0 },
    fee: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    sold: { type: Number, default: 0, min: 0 },
    additionalQuestions: { type: [additionalQuestionSchema], default: [] },
    batches: {
      type: [batchSchema],
      validate: [(value: IEventBatch[]) => value.length > 0, 'Informe ao menos um lote por modalidade'],
      default: [],
    },
  },
  { _id: true },
)

const organizerSchema = new Schema<IEventOrganizer>(
  {
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const operationalDetailsSchema = new Schema<IEventOperationalDetails>(
  {
    regulationUrl: { type: String, trim: true, default: '' },
    checkInNotes: { type: String, trim: true, default: '' },
    cancellationPolicy: { type: String, trim: true, default: '' },
    cancellationPolicySettings: {
      type: new Schema(
        {
          fullRefundHoursBeforeEvent: { type: Number, min: 0, default: 72 },
          partialRefundHoursBeforeEvent: { type: Number, min: 0, default: 24 },
          partialRefundPercent: { type: Number, min: 0, max: 100, default: 50 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    kitSummary: { type: String, trim: true, default: '' },
    additionalQuestions: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const eventStravaRouteSchema = new Schema<IEventStravaRoute>(
  {
    title: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, default: '' },
    embedCode: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const eventPageSectionsSchema = new Schema<IEventPageSections>(
  {
    aboutEvent: { type: String, trim: true, default: '' },
    routes: { type: String, trim: true, default: '' },
    registrations: { type: String, trim: true, default: '' },
    kitDelivery: { type: String, trim: true, default: '' },
    awards: { type: String, trim: true, default: '' },
    schedule: { type: String, trim: true, default: '' },
    regulation: { type: String, trim: true, default: '' },
    stravaRoutes: { type: [eventStravaRouteSchema], default: [] },
    stravaEmbedUrl: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      enum: ['running', 'triathlon', 'fight', 'cycling', 'fitness', 'other'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    contentHtml: { type: String, trim: true, default: '' },
    zipCode: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'Brasil' },
    venue: { type: String, required: true, trim: true },
    addressLine: { type: String, required: true, trim: true },
    addressNumber: { type: String, required: true, trim: true },
    mapUrl: { type: String, trim: true, default: '' },
    coverImage: {
      type: String,
      trim: true,
      default:
        'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=80',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
    },
    organizer: { type: organizerSchema, required: true },
    operationalDetails: { type: operationalDetailsSchema, default: () => ({}) },
    pageSections: { type: eventPageSectionsSchema, default: () => ({}) },
    ticketTypes: {
      type: [ticketTypeSchema],
      validate: [
        (value: IEventTicketType[]) => value.length > 0,
        'Informe ao menos um tipo de ingresso',
      ],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    managedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    highlights: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
)

export const Event = mongoose.model<IEvent>('Event', eventSchema)