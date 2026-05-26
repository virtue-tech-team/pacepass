import { z } from 'zod'

import { Event } from '../models/Event.js'
import { Registration } from '../models/Registration.js'
import { User } from '../models/User.js'
import { buildRegistrationCancellationPolicy } from './cancellation-policy.service.js'

export const participantSchema = z.object({
  fullName: z.string().min(3),
  birthDate: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  documentType: z.string().optional().default('CPF'),
  document: z.string().optional().default(''),
  email: z.string().email(),
  phone: z.string().min(8),
  zipCode: z.string().optional().default(''),
  country: z.string().optional().default('Brasil'),
  state: z.string().optional().default(''),
  city: z.string().optional().default(''),
  addressLine: z.string().optional().default(''),
  addressNumber: z.string().optional().default(''),
  emergencyContact: z.string().optional().default(''),
  profession: z.string().optional().default(''),
  team: z.string().optional().default(''),
  company: z.string().optional().default(''),
  privacyAccepted: z.literal(true),
})

export const additionalAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1),
})

export const registrationCheckoutSchema = z.object({
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  batchId: z.string().min(1),
  buyerType: z.enum(['self', 'third_party']).default('self'),
  paymentMethodPreference: z.enum(['card', 'pix']).optional(),
  participant: participantSchema,
  additionalAnswers: z.array(additionalAnswerSchema).optional().default([]),
})

export type RegistrationCheckoutInput = z.infer<typeof registrationCheckoutSchema>

export function generateOrderNumber() {
  return `${Date.now()}${Math.floor(100 + Math.random() * 900)}`
}

export function calculatePlatformFee(subtotal: number, platformFeePercent: number) {
  return Number(((subtotal * platformFeePercent) / 100).toFixed(2))
}

export function mapStripeMethodType(type?: string): 'stripe' | 'pix' | 'credit_card' {
  if (type === 'pix') {
    return 'pix'
  }

  if (type === 'card') {
    return 'credit_card'
  }

  return 'stripe'
}

function getBatchDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function isBatchCurrentlyOpen(batch: { status: string; startAt: string | Date; endAt: string | Date }, referenceDate = new Date()) {
  const startsAt = getBatchDate(batch.startAt)
  const endsAt = getBatchDate(batch.endAt)

  return batch.status === 'active' && startsAt.getTime() <= referenceDate.getTime() && endsAt.getTime() >= referenceDate.getTime()
}

export function getBatchAvailabilityMessage(batch: { status: string; startAt: string | Date; endAt: string | Date }, referenceDate = new Date()) {
  if (batch.status === 'closed') {
    return 'Este lote está encerrado e não aceita novas inscrições.'
  }

  const startsAt = getBatchDate(batch.startAt)
  const endsAt = getBatchDate(batch.endAt)

  if (startsAt.getTime() > referenceDate.getTime()) {
    return 'Este lote ainda não iniciou as vendas.'
  }

  if (endsAt.getTime() < referenceDate.getTime()) {
    return 'Este lote já encerrou o período de vendas.'
  }

  return 'Este lote não está disponível para novas inscrições no momento.'
}

export function serializeRegistration(registration: {
  _id: unknown
  orderNumber: string
  status: string
  paymentMethod: string
  subtotal: number
  feeAmount: number
  totalAmount: number
  buyerType: string
  participant: unknown
  selection: unknown
  createdAt: Date
  paidAt?: Date | null
  cancelledAt?: Date | null
  refundedAt?: Date | null
  cancellationReason?: string
  refundAmount?: number
  history?: Array<{
    _id?: unknown
    action: string
    actorRole: string
    actorUserId?: unknown
    description: string
    reason?: string
    emailType?: string
    refundAmount?: number
    refundPercent?: number
    stripeRefundId?: string
    createdAt: Date
  }>
  event?: unknown
}) {
  const event = registration.event && typeof registration.event === 'object' ? registration.event as { startDate?: Date | string } : undefined
  const eventWithPolicy = registration.event && typeof registration.event === 'object'
    ? registration.event as {
        startDate?: Date | string
        operationalDetails?: {
          cancellationPolicySettings?: {
            fullRefundHoursBeforeEvent?: number
            partialRefundHoursBeforeEvent?: number
            partialRefundPercent?: number
          }
        }
      }
    : undefined
  const cancellationPolicy = event?.startDate
    ? buildRegistrationCancellationPolicy(
        event.startDate,
        registration.totalAmount,
        registration.status,
        eventWithPolicy?.operationalDetails?.cancellationPolicySettings,
      )
    : null

  return {
    _id: registration._id,
    orderNumber: registration.orderNumber,
    status: registration.status,
    paymentMethod: registration.paymentMethod,
    subtotal: registration.subtotal,
    feeAmount: registration.feeAmount,
    totalAmount: registration.totalAmount,
    buyerType: registration.buyerType,
    participant: registration.participant,
    selection: registration.selection,
    event: registration.event,
    createdAt: registration.createdAt,
    paidAt: registration.paidAt || null,
    cancelledAt: registration.cancelledAt || null,
    refundedAt: registration.refundedAt || null,
    cancellationReason: registration.cancellationReason || '',
    refundAmount: registration.refundAmount || 0,
    cancellationPolicy,
    history: (registration.history || []).map((entry) => ({
      _id: entry._id,
      action: entry.action,
      actorRole: entry.actorRole,
      actorUserId: entry.actorUserId || null,
      description: entry.description,
      reason: entry.reason || '',
      emailType: entry.emailType || '',
      refundAmount: entry.refundAmount || 0,
      refundPercent: entry.refundPercent || 0,
      stripeRefundId: entry.stripeRefundId || '',
      createdAt: entry.createdAt,
    })),
  }
}

export async function buildRegistrationCheckoutDraft(payload: RegistrationCheckoutInput) {
  const event = await Event.findById(payload.eventId)
  const now = new Date()

  if (!event || event.status !== 'published') {
    throw new Error('Evento não encontrado para inscrição.')
  }

  const ticket = event.ticketTypes.find((currentTicket) => currentTicket._id?.toString() === payload.ticketTypeId)

  if (!ticket) {
    throw new Error('Modalidade não encontrada para este evento.')
  }

  const batch = ticket.batches.find((currentBatch) => currentBatch._id?.toString() === payload.batchId)

  if (!batch) {
    throw new Error('Lote não encontrado para a modalidade selecionada.')
  }

  if (!isBatchCurrentlyOpen(batch, now)) {
    throw new Error(getBatchAvailabilityMessage(batch, now))
  }

  if (ticket.sold >= ticket.quantity) {
    throw new Error('Esta modalidade já atingiu o limite de inscrições.')
  }

  const reservationWindowStart = new Date(Date.now() - 15 * 60 * 1000)
  const batchRegistrations = await Registration.countDocuments({
    event: event._id,
    'selection.ticketTypeId': payload.ticketTypeId,
    'selection.batchId': payload.batchId,
    $or: [
      { status: 'confirmed' },
      { status: 'processing_payment' },
      { status: 'pending_payment', createdAt: { $gte: reservationWindowStart } },
    ],
  })

  if (batchRegistrations >= batch.quantity) {
    throw new Error('Este lote não possui mais vagas disponíveis.')
  }

  const requiredQuestions = ticket.additionalQuestions.filter((question) => question.required)
  const missingAnswer = requiredQuestions.find((question) => {
    const questionId = question._id?.toString() || question.label
    return !payload.additionalAnswers.find((answer) => answer.questionId === questionId && answer.answer.trim())
  })

  if (missingAnswer) {
    throw new Error(`Responda a pergunta obrigatória: ${missingAnswer.label}.`)
  }

  const answers = payload.additionalAnswers.map((answer) => {
    const matchingQuestion = ticket.additionalQuestions.find((question) => {
      const questionId = question._id?.toString() || question.label
      return questionId === answer.questionId
    })

    return {
      questionId: answer.questionId,
      label: matchingQuestion?.label || 'Pergunta adicional',
      answer: answer.answer.trim(),
    }
  })

  const subtotal = batch.price
  const organizer = await User.findById(event.managedBy).select('platformFeePercent')
  const feeAmount = calculatePlatformFee(subtotal, organizer?.platformFeePercent || 0)
  const totalAmount = subtotal + feeAmount

  return {
    event,
    ticket,
    batch,
    answers,
    subtotal,
    feeAmount,
    totalAmount,
    selection: {
      groupId: ticket.groupId,
      groupName: ticket.groupName,
      ticketTypeId: payload.ticketTypeId,
      ticketName: ticket.name,
      batchId: payload.batchId,
      batchName: batch.name,
    },
  }
}