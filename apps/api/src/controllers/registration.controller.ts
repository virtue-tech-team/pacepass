import type { NextFunction, Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'

import { roles } from '../constants/roles.js'
import { env } from '../config/env.js'
import { Event } from '../models/Event.js'
import { Registration } from '../models/Registration.js'
import { buildRegistrationCancellationPolicy } from '../services/cancellation-policy.service.js'
import { appendRegistrationHistoryEntry } from '../services/registration-history.service.js'
import {
  buildRegistrationCheckoutDraft,
  generateOrderNumber,
  registrationCheckoutSchema,
  serializeRegistration,
} from '../services/registration-checkout.service.js'
import {
  buildRegistrationReceiptFilename,
  createRegistrationReceiptPdf,
  findRegistrationWithEvent,
  releaseRegistrationCapacity,
  sendRegistrationConfirmation,
  sendRegistrationReversalCommunication,
} from '../services/registration-fulfillment.service.js'

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null

const cancelRegistrationSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
})

type CancellationRequestSource = 'support' | 'customer'

async function getAccessibleRegistration(userId: string, role: string, registrationId: string) {
  const registration = await findRegistrationWithEvent(registrationId)

  if (!registration) {
    return null
  }

  if (role === roles.customer) {
    return registration.user.toString() === userId ? registration : null
  }

  if (role === roles.eventAdmin) {
    const event = registration.event

    if (!event || typeof event === 'string' || !('managedBy' in event)) {
      return null
    }

    return event.managedBy?.toString() === userId ? registration : null
  }

  return registration
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function createRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = registrationCheckoutSchema.parse(req.body)

    if (!req.user) {
      res.status(401).json({ message: 'Faça login para concluir a inscrição.' })
      return
    }

    const draft = await buildRegistrationCheckoutDraft(payload)

    if (draft.totalAmount > 0) {
      res.status(400).json({ message: 'Esta inscrição agora depende de pagamento Stripe. Inicie o pagamento no checkout.' })
      return
    }

    const registration = await Registration.create({
      user: req.user._id,
      event: draft.event._id,
      orderNumber: generateOrderNumber(),
      buyerType: payload.buyerType,
      status: 'confirmed',
      paymentMethod: 'stripe',
      subtotal: draft.subtotal,
      feeAmount: draft.feeAmount,
      totalAmount: draft.totalAmount,
      stripePaymentIntentId: '',
      stripePaymentMethodType: '',
      paidAt: new Date(),
      participant: payload.participant,
      selection: draft.selection,
      additionalAnswers: draft.answers,
      history: [],
    })

    await appendRegistrationHistoryEntry(registration._id, {
      action: 'created',
      actorRole: 'customer',
      actorUserId: req.user._id,
      description: 'Inscrição gratuita criada pelo participante.',
    })
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'payment_confirmed',
      actorRole: 'system',
      description: 'Inscrição confirmada sem cobrança financeira.',
    })

    draft.ticket.sold += 1
    draft.event.markModified('ticketTypes')
    await draft.event.save()

    try {
      const populatedRegistration = await findRegistrationWithEvent(registration._id.toString())

      if (populatedRegistration) {
        await sendRegistrationConfirmation(populatedRegistration)
      }
    } catch (error) {
      console.error('[registration-confirmation-email]', error)
    }

    res.status(201).json({
      registration: serializeRegistration(registration),
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para visualizar sua inscrição.' })
      return
    }

    const registration = await Registration.findOne({ _id: req.params.id, user: req.user._id })
      .populate('event', 'title slug startDate city state venue coverImage operationalDetails')
      .lean()

    if (!registration) {
      res.status(404).json({ message: 'Inscrição não encontrada.' })
      return
    }

    res.json({ registration: serializeRegistration(registration) })
  } catch (error) {
    next(error)
  }
}

export async function listMyRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para visualizar suas inscrições.' })
      return
    }

    const registrations = await Registration.find({ user: req.user._id })
      .populate('event', 'title slug startDate city state venue coverImage operationalDetails')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      registrations: registrations.map((registration) => ({
        ...serializeRegistration(registration),
      })),
    })
  } catch (error) {
    next(error)
  }
}

export async function downloadRegistrationReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para acessar o comprovante.' })
      return
    }

    const registration = await getAccessibleRegistration(req.user._id.toString(), req.user.role, String(req.params.id))

    if (!registration) {
      res.status(404).json({ message: 'Inscrição não encontrada.' })
      return
    }

    if (registration.status !== 'confirmed') {
      res.status(409).json({ message: 'O comprovante só está disponível para inscrições confirmadas.' })
      return
    }

    const pdf = await createRegistrationReceiptPdf(registration)
    const filename = buildRegistrationReceiptFilename(registration.orderNumber)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (error) {
    next(error)
  }
}

export async function resendRegistrationReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para reenviar o comprovante.' })
      return
    }

    const registration = await getAccessibleRegistration(req.user._id.toString(), req.user.role, String(req.params.id))

    if (!registration) {
      res.status(404).json({ message: 'Inscrição não encontrada.' })
      return
    }

    if (registration.status !== 'confirmed') {
      res.status(409).json({ message: 'O comprovante só pode ser reenviado para inscrições confirmadas.' })
      return
    }

    await sendRegistrationConfirmation(registration)
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'receipt_resent',
      actorRole: req.user.role,
      actorUserId: req.user._id,
      description: req.user.role === 'customer'
        ? 'Participante solicitou novo envio do comprovante por e-mail.'
        : 'Operação solicitou novo envio do comprovante por e-mail.',
      emailType: 'receipt_resend',
    })

    res.json({ message: 'Comprovante reenviado com sucesso por e-mail.' })
  } catch (error) {
    next(error)
  }
}

export async function searchSupportRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para consultar inscrições.' })
      return
    }

    const query = String(req.query.q || '').trim()
    const status = String(req.query.status || '').trim()
    const eventId = String(req.query.eventId || '').trim()
    const paymentMethod = String(req.query.paymentMethod || '').trim()
    const historyAction = String(req.query.historyAction || '').trim()
    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100)
    const filters: Record<string, unknown> = {}

    let accessibleEventIds: string[] | null = null

    if (req.user.role === roles.eventAdmin) {
      const managedEvents = await Event.find({ managedBy: req.user._id }).select('_id').lean()
      accessibleEventIds = managedEvents.map((event) => event._id.toString())

      if (accessibleEventIds.length === 0) {
        res.json({ registrations: [] })
        return
      }

      filters.event = { $in: accessibleEventIds }
    }

    if (status && ['pending_payment', 'processing_payment', 'confirmed', 'payment_failed', 'cancelled', 'refunded'].includes(status)) {
      filters.status = status
    }

    if (paymentMethod && ['stripe', 'pix', 'credit_card'].includes(paymentMethod)) {
      filters.paymentMethod = paymentMethod
    }

    if (historyAction && ['created', 'payment_confirmed', 'receipt_resent', 'cancelled', 'refund_processed', 'email_sent', 'email_failed'].includes(historyAction)) {
      filters['history.action'] = historyAction
    }

    if (eventId) {
      if (accessibleEventIds && !accessibleEventIds.includes(eventId)) {
        res.json({
          registrations: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
        return
      }

      filters.event = eventId
    }

    if (query) {
      const regex = new RegExp(escapeRegex(query), 'i')
      const eventMatches = await Event.find({
        ...(accessibleEventIds ? { _id: { $in: accessibleEventIds } } : {}),
        title: regex,
      })
        .select('_id')
        .lean()

      const orFilters: Array<Record<string, unknown>> = [
        { orderNumber: regex },
        { 'participant.fullName': regex },
        { 'participant.email': regex },
      ]

      if (eventMatches.length > 0) {
        orFilters.push({ event: { $in: eventMatches.map((event) => event._id) } })
      }

      filters.$or = orFilters
    }

    const total = await Registration.countDocuments(filters)

    const registrations = await Registration.find(filters)
      .populate('event', 'title slug startDate city state venue coverImage operationalDetails')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({
      registrations: registrations.map((registration) => serializeRegistration(registration)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

async function cancelAccessibleRegistration(
  req: Request,
  res: Response,
  source: CancellationRequestSource,
) {
  if (!req.user) {
    res.status(401).json({ message: 'Faça login para cancelar a inscrição.' })
    return
  }

  const payload = cancelRegistrationSchema.parse(req.body || {})
  const registration = await getAccessibleRegistration(req.user._id.toString(), req.user.role, String(req.params.id))

  if (!registration) {
    res.status(404).json({ message: 'Inscrição não encontrada.' })
    return
  }

  if (source === 'support' && !['event_admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Você não tem permissão para cancelar ou estornar esta inscrição.' })
    return
  }

  if (source === 'customer' && req.user.role !== roles.customer) {
    res.status(403).json({ message: 'Somente o participante pode usar este fluxo de autoatendimento.' })
    return
  }

  if (registration.status === 'cancelled' || registration.status === 'refunded') {
    res.status(409).json({ message: 'Esta inscrição já foi revertida anteriormente.' })
    return
  }

  if (registration.status === 'payment_failed') {
    res.status(409).json({ message: 'Inscrições com pagamento falho não podem ser estornadas.' })
    return
  }

  const registrationDocument = await Registration.findById(registration._id)

  if (!registrationDocument) {
    res.status(404).json({ message: 'Inscrição não encontrada.' })
    return
  }

  const reason = payload.reason || (source === 'customer'
    ? 'Cancelamento solicitado pelo próprio participante.'
    : 'Cancelamento operacional solicitado pelo suporte.')
  const wasConfirmed = registrationDocument.status === 'confirmed'
  const cancellationPolicy = buildRegistrationCancellationPolicy(
    registration.event.startDate,
    registrationDocument.totalAmount,
    registrationDocument.status,
    registration.event.operationalDetails?.cancellationPolicySettings,
  )

  if (
    registrationDocument.status === 'confirmed'
    && registrationDocument.stripePaymentIntentId
    && registrationDocument.totalAmount > 0
    && (cancellationPolicy.outcome === 'full_refund' || cancellationPolicy.outcome === 'partial_refund')
  ) {
    if (!stripe) {
      res.status(500).json({ message: 'Stripe não configurado para processar estorno.' })
      return
    }

    const refund = await stripe.refunds.create({
      payment_intent: registrationDocument.stripePaymentIntentId,
      amount: Math.round(cancellationPolicy.currentRefundAmount * 100),
      reason: 'requested_by_customer',
      metadata: {
        registrationId: registrationDocument._id.toString(),
        orderNumber: registrationDocument.orderNumber,
        source,
      },
    })

    registrationDocument.status = 'refunded'
    registrationDocument.cancelledAt = new Date()
    registrationDocument.refundedAt = new Date()
    registrationDocument.refundAmount = Number(((refund.amount || Math.round(cancellationPolicy.currentRefundAmount * 100)) / 100).toFixed(2))
    registrationDocument.cancellationReason = reason
    registrationDocument.stripeRefundId = refund.id
    await registrationDocument.save()

    await appendRegistrationHistoryEntry(registrationDocument._id, {
      action: 'refund_processed',
      actorRole: req.user.role,
      actorUserId: req.user._id,
      description: source === 'customer'
        ? `Participante cancelou a inscrição com estorno automático de ${cancellationPolicy.currentRefundPercent}%.`
        : `Inscrição cancelada com estorno automático de ${cancellationPolicy.currentRefundPercent}%.`,
      reason,
      refundAmount: registrationDocument.refundAmount,
      refundPercent: cancellationPolicy.currentRefundPercent,
      stripeRefundId: refund.id,
    })
  } else {
    if (
      registrationDocument.status !== 'pending_payment'
      && registrationDocument.status !== 'processing_payment'
      && registrationDocument.status !== 'confirmed'
    ) {
      res.status(409).json({ message: 'Esta inscrição não pode ser cancelada automaticamente no estado atual.' })
      return
    }

    if (registrationDocument.stripePaymentIntentId && stripe && registrationDocument.status !== 'confirmed') {
      try {
        await stripe.paymentIntents.cancel(registrationDocument.stripePaymentIntentId)
      } catch (error) {
        console.error('[registration-cancel-payment-intent]', error)
      }
    }

    registrationDocument.status = 'cancelled'
    registrationDocument.cancelledAt = new Date()
    registrationDocument.cancellationReason = reason
    registrationDocument.refundedAt = null
    registrationDocument.refundAmount = 0
    await registrationDocument.save()

    await appendRegistrationHistoryEntry(registrationDocument._id, {
      action: 'cancelled',
      actorRole: req.user.role,
      actorUserId: req.user._id,
      description: source === 'customer'
        ? (cancellationPolicy.outcome === 'no_refund'
          ? 'Participante cancelou a inscrição sem estorno, conforme política vigente.'
          : 'Participante cancelou a inscrição em autoatendimento.')
        : (cancellationPolicy.outcome === 'no_refund'
          ? 'Inscrição cancelada sem estorno, conforme política automática vigente.'
          : 'Inscrição cancelada automaticamente sem necessidade de estorno financeiro.'),
      reason,
    })
  }

  const updatedRegistration = await findRegistrationWithEvent(registrationDocument._id.toString())

  if (!updatedRegistration) {
    res.status(404).json({ message: 'Inscrição não encontrada após atualização.' })
    return
  }

  if (wasConfirmed) {
    await releaseRegistrationCapacity(updatedRegistration)
  }

  try {
    await sendRegistrationReversalCommunication(updatedRegistration)
  } catch (error) {
    console.error('[registration-reversal-email]', error)
  }

  res.json({
    message: updatedRegistration.status === 'refunded'
      ? source === 'customer'
        ? 'Cancelamento solicitado com estorno processado e comunicado por e-mail.'
        : 'Estorno processado e comunicado por e-mail.'
      : source === 'customer'
        ? 'Cancelamento solicitado e comunicado por e-mail.'
        : 'Inscrição cancelada e comunicada por e-mail.',
    registration: serializeRegistration(updatedRegistration),
  })
}

export async function cancelRegistrationFromSupport(req: Request, res: Response, next: NextFunction) {
  try {
    await cancelAccessibleRegistration(req, res, 'support')
  } catch (error) {
    next(error)
  }
}

export async function cancelMyRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    await cancelAccessibleRegistration(req, res, 'customer')
  } catch (error) {
    next(error)
  }
}