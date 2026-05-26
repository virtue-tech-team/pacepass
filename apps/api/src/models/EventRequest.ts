import mongoose, { HydratedDocument, Schema } from 'mongoose'

export const eventRequestCategories = [
  'road_running',
  'cycling',
  'obstacle_race',
  'kids_race',
  'canoeing',
  'virtual_challenges',
  'swimming',
  'trail_run',
  'triathlon',
  'surf',
  'courses',
  'other_sports',
  'other_events',
] as const

export const eventRequestVolumes = ['1', '2_4', '5_10', '10_plus'] as const

export const eventRequestRegulationStatuses = ['ready', 'not_ready', 'need_help'] as const

export const eventRequestMonths = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'not_defined',
] as const

export const eventRequestStatuses = ['pending', 'approved', 'rejected'] as const

type EventRequestCategory = (typeof eventRequestCategories)[number]
type EventRequestVolume = (typeof eventRequestVolumes)[number]
type EventRequestRegulationStatus = (typeof eventRequestRegulationStatuses)[number]
type EventRequestMonth = (typeof eventRequestMonths)[number]
type EventRequestStatus = (typeof eventRequestStatuses)[number]

export interface IEventRequest {
  fullName: string
  email: string
  phone: string
  company: string
  region: string
  sportCategory: EventRequestCategory
  eventsPerYear: EventRequestVolume
  eventName: string
  regulationStatus: EventRequestRegulationStatus
  preferredMonth: EventRequestMonth
  referralName: string
  status: EventRequestStatus
  createdAt: Date
  updatedAt: Date
}

export type EventRequestDocument = HydratedDocument<IEventRequest>

const eventRequestSchema = new Schema<IEventRequest>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    region: {
      type: String,
      required: true,
      trim: true,
    },
    sportCategory: {
      type: String,
      enum: eventRequestCategories,
      required: true,
    },
    eventsPerYear: {
      type: String,
      enum: eventRequestVolumes,
      required: true,
    },
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    regulationStatus: {
      type: String,
      enum: eventRequestRegulationStatuses,
      required: true,
    },
    preferredMonth: {
      type: String,
      enum: eventRequestMonths,
      required: true,
    },
    referralName: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: eventRequestStatuses,
      default: 'pending',
    },
  },
  {
    timestamps: true,
  },
)

export const EventRequest = mongoose.model<IEventRequest>('EventRequest', eventRequestSchema)