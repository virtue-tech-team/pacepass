import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { roles } from '../constants/roles.js'
import { Event, type EventDocument } from '../models/Event.js'
import {
  buildCancellationPolicySummary,
  type EventCancellationPolicySettingsInput,
} from '../services/cancellation-policy.service.js'
import { buildPublicEventStatusFilter, isEventPubliclyVisible } from '../services/event-publication.service.js'
import { slugify } from '../utils/slugify.js'

function decorateEventWithMvpPolicy<
  T extends {
    operationalDetails?: {
      cancellationPolicy?: string
      cancellationPolicySettings?: EventCancellationPolicySettingsInput
    }
  },
>(event: T) {
  const policySettings = event.operationalDetails?.cancellationPolicySettings
  const policySummary = buildCancellationPolicySummary(policySettings)

  return {
    ...event,
    cancellationPolicySummary: policySummary,
    operationalDetails: {
      ...event.operationalDetails,
      cancellationPolicy: event.operationalDetails?.cancellationPolicy || policySummary,
      cancellationPolicySettings: {
        fullRefundHoursBeforeEvent: policySettings?.fullRefundHoursBeforeEvent ?? 72,
        partialRefundHoursBeforeEvent: policySettings?.partialRefundHoursBeforeEvent ?? 24,
        partialRefundPercent: policySettings?.partialRefundPercent ?? 50,
      },
    },
  }
}

function normalizeEventOperationalDetails(
  operationalDetails: z.infer<typeof eventSchema>['operationalDetails'],
) {
  return {
    ...operationalDetails,
    cancellationPolicySettings: {
      fullRefundHoursBeforeEvent: operationalDetails.cancellationPolicySettings.fullRefundHoursBeforeEvent ?? 72,
      partialRefundHoursBeforeEvent: operationalDetails.cancellationPolicySettings.partialRefundHoursBeforeEvent ?? 24,
      partialRefundPercent: operationalDetails.cancellationPolicySettings.partialRefundPercent ?? 50,
    },
  }
}

const cancellationPolicySettingsSchema = z.object({
  fullRefundHoursBeforeEvent: z.coerce.number().int().min(0).optional(),
  partialRefundHoursBeforeEvent: z.coerce.number().int().min(0).optional(),
  partialRefundPercent: z.coerce.number().min(0).max(100).optional(),
}).superRefine((settings, context) => {
  const fullRefundHours = settings.fullRefundHoursBeforeEvent ?? 72
  const partialRefundHours = settings.partialRefundHoursBeforeEvent ?? 24

  if (partialRefundHours > fullRefundHours) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O prazo de estorno parcial não pode ser maior que o prazo de estorno integral.',
      path: ['partialRefundHoursBeforeEvent'],
    })
  }
})

const batchSchema = z.object({
  name: z.string().min(2),
  startAt: z.string(),
  endAt: z.string(),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  status: z.enum(['scheduled', 'active', 'closed']).default('scheduled'),
})

const additionalQuestionSchema = z.object({
  label: z.string().min(2),
  type: z.enum(['text', 'select', 'checkbox', 'number']).default('text'),
  required: z.boolean().optional().default(false),
  helperText: z.string().optional().default(''),
  placeholder: z.string().optional().default(''),
  options: z.array(z.string()).optional().default([]),
}).superRefine((question, context) => {
  if ((question.type === 'select' || question.type === 'checkbox') && question.options.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Perguntas do tipo seleção precisam ter ao menos uma opção.',
      path: ['options'],
    })
  }
})

const ticketTypeSchema = z.object({
  groupId: z.string().min(2),
  groupName: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional().default(''),
  price: z.coerce.number().min(0).optional().default(0),
  fee: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().int().min(1),
  additionalQuestions: z.array(additionalQuestionSchema).optional().default([]),
  batches: z.array(batchSchema).min(1),
})

function resolveCategoryPrice(
  batches: Array<{ price: number; status: 'scheduled' | 'active' | 'closed'; startAt: string | Date }>,
) {
  const activeBatch = batches.find((batch) => batch.status === 'active')

  if (activeBatch) {
    return activeBatch.price
  }

  const scheduledBatch = [...batches]
    .filter((batch) => batch.status === 'scheduled')
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0]

  if (scheduledBatch) {
    return scheduledBatch.price
  }

  return Math.min(...batches.map((batch) => batch.price))
}

function mapTicketType(ticketType: z.infer<typeof ticketTypeSchema>) {
  const batches = ticketType.batches.map((batch) => ({
    ...batch,
    startAt: new Date(batch.startAt),
    endAt: new Date(batch.endAt),
  }))

  return {
    ...ticketType,
    price: resolveCategoryPrice(ticketType.batches),
    sold: 0,
    additionalQuestions: ticketType.additionalQuestions.map((question) => ({
      ...question,
      options: question.options.filter(Boolean),
    })),
    batches,
  }
}

const eventSchema = z.object({
  title: z.string().min(4),
  category: z.enum(['running', 'triathlon', 'fight', 'cycling', 'fitness', 'other']),
  description: z.string().min(10),
  contentHtml: z.string().optional().default(''),
  zipCode: z.string().min(8),
  city: z.string().min(2),
  state: z.string().min(2),
  country: z.string().min(2).default('Brasil'),
  venue: z.string().min(4),
  addressLine: z.string().min(4),
  addressNumber: z.string().min(1),
  mapUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
  coverImage: z.union([z.string().url(), z.literal('')]).optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
  organizer: z.object({
    name: z.string().min(3),
    contactEmail: z.string().email(),
    contactPhone: z.string().optional().default(''),
  }),
  
  pageSections: z.object({
    aboutEvent: z.string().optional().default(''),
    routes: z.string().optional().default(''),
    registrations: z.string().optional().default(''),
    kitDelivery: z.string().optional().default(''),
    awards: z.string().optional().default(''),
    schedule: z.string().optional().default(''),
    regulation: z.string().optional().default(''),
    stravaRoutes: z.array(z.object({
      title: z.string().optional().default(''),
      url: z.union([z.string().url(), z.literal('')]).optional().default(''),
      embedCode: z.string().optional().default(''),
    })).optional().default([]),
    stravaEmbedUrl: z.string().optional().default(''),
  }).optional().default({
    aboutEvent: '',
    routes: '',
    registrations: '',
    kitDelivery: '',
    awards: '',
    schedule: '',
    regulation: '',
    stravaRoutes: [],
    stravaEmbedUrl: '',
  }),
  operationalDetails: z.object({
    regulationUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
    checkInNotes: z.string().optional().default(''),
    cancellationPolicy: z.string().optional().default(''),
    cancellationPolicySettings: cancellationPolicySettingsSchema.optional().default({
      fullRefundHoursBeforeEvent: 72,
      partialRefundHoursBeforeEvent: 24,
      partialRefundPercent: 50,
    }),
    kitSummary: z.string().optional().default(''),
    additionalQuestions: z.string().optional().default(''),
  }).optional().default({
    regulationUrl: '',
    checkInNotes: '',
    cancellationPolicy: '',
    cancellationPolicySettings: {
      fullRefundHoursBeforeEvent: 72,
      partialRefundHoursBeforeEvent: 24,
      partialRefundPercent: 50,
    },
    kitSummary: '',
    additionalQuestions: '',
  }),
  managedBy: z.string().optional(),
  highlights: z.array(z.string()).optional().default([]),
  ticketTypes: z.array(ticketTypeSchema).min(1),
})

function canManageEvent(user: Express.Request['user'], event: EventDocument) {
  if (!user) {
    return false
  }

  if (user.role === roles.superAdmin) {
    return true
  }

  return event.managedBy.toString() === user._id.toString()
}

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: Record<string, unknown> = {}

    if (typeof req.query.city === 'string' && req.query.city) {
      filters.city = new RegExp(req.query.city, 'i')
    }

    if (typeof req.query.category === 'string' && req.query.category) {
      filters.category = req.query.category
    }

    filters.status = buildPublicEventStatusFilter(typeof req.query.status === 'string' ? req.query.status : undefined)

    const events = await Event.find(filters)
      .populate('managedBy', 'name email role platformFeePercent')
      .sort({ startDate: 1 })
      .lean()

    res.json({ events: events.map((event) => decorateEventWithMvpPolicy(event)) })
  } catch (error) {
    next(error)
  }
}

export async function getEventById(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await Event.findById(req.params.id)
      .populate('managedBy', 'name email role platformFeePercent')
      .lean()

    if (!event) {
      res.status(404).json({ message: 'Evento não encontrado.' })
      return
    }

    res.json({ event: decorateEventWithMvpPolicy(event) })
  } catch (error) {
    next(error)
  }
}

export async function getEventBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await Event.findOne({ slug: req.params.slug })
      .populate('managedBy', 'name email role platformFeePercent')
      .lean()

    if (!event || !isEventPubliclyVisible(event)) {
      res.status(404).json({ message: 'Evento não encontrado.' })
      return
    }

    res.json({ event: decorateEventWithMvpPolicy(event) })
  } catch (error) {
    next(error)
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = eventSchema.parse(req.body)
    const slugBase = slugify(payload.title)
    const slugCount = await Event.countDocuments({ slug: new RegExp(`^${slugBase}`) })

    const event = await Event.create({
      ...payload,
      slug: slugCount ? `${slugBase}-${slugCount + 1}` : slugBase,
      createdBy: req.user!._id,
      managedBy: payload.managedBy || req.user!._id,
      coverImage: payload.coverImage || undefined,
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      operationalDetails: normalizeEventOperationalDetails(payload.operationalDetails),
      ticketTypes: payload.ticketTypes.map(mapTicketType),
    })

    res.status(201).json({ event: decorateEventWithMvpPolicy(event.toObject()) })
  } catch (error) {
    next(error)
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = eventSchema.parse(req.body)
    const event = await Event.findById(req.params.id)

    if (!event) {
      res.status(404).json({ message: 'Evento não encontrado.' })
      return
    }

    if (!canManageEvent(req.user, event)) {
      res.status(403).json({ message: 'Você não pode editar este evento.' })
      return
    }

    event.title = payload.title
    event.category = payload.category
    event.description = payload.description
    event.contentHtml = payload.contentHtml
    event.zipCode = payload.zipCode
    event.city = payload.city
    event.state = payload.state
    event.country = payload.country
    event.venue = payload.venue
    event.addressLine = payload.addressLine
    event.addressNumber = payload.addressNumber
    event.mapUrl = payload.mapUrl
    event.coverImage = payload.coverImage || event.coverImage
    event.startDate = new Date(payload.startDate)
    event.endDate = new Date(payload.endDate)
    event.status = payload.status
    event.organizer = payload.organizer
    event.pageSections = payload.pageSections
    event.operationalDetails = normalizeEventOperationalDetails(payload.operationalDetails)
    event.highlights = payload.highlights
    event.ticketTypes = payload.ticketTypes.map(mapTicketType)

    if (req.user?.role === roles.superAdmin && payload.managedBy) {
      event.managedBy = payload.managedBy as never
    }

    await event.save()

    res.json({ event: decorateEventWithMvpPolicy(event.toObject()) })
  } catch (error) {
    next(error)
  }
}

export async function updateEventStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      status: z.enum(['draft', 'published', 'closed']),
    })
    const payload = schema.parse(req.body)
    const event = await Event.findById(req.params.id)

    if (!event) {
      res.status(404).json({ message: 'Evento não encontrado.' })
      return
    }

    if (!canManageEvent(req.user, event)) {
      res.status(403).json({ message: 'Você não pode alterar este evento.' })
      return
    }

    event.status = payload.status
    await event.save()

    res.json({ event })
  } catch (error) {
    next(error)
  }
}