import type { NextFunction, Request, Response } from 'express'
import Stripe from 'stripe'

import { env } from '../config/env.js'
import { Event } from '../models/Event.js'
import { Registration } from '../models/Registration.js'
import { buildRegistrationCancellationPolicy } from '../services/cancellation-policy.service.js'
import { appendRegistrationHistoryEntry } from '../services/registration-history.service.js'
import {
  buildRegistrationCheckoutDraft,
  generateOrderNumber,
  mapStripeMethodType,
  registrationCheckoutSchema,
  serializeRegistration,
} from '../services/registration-checkout.service.js'
import {
  findRegistrationWithEvent,
  releaseRegistrationCapacity,
  sendRegistrationConfirmation,
  sendRegistrationReversalCommunication,
} from '../services/registration-fulfillment.service.js'

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null

function resolvePaymentMethodTypes(preference?: 'card' | 'pix') {
  if (!preference) {
    return env.stripePaymentMethodTypes
  }

  if (env.stripePaymentMethodTypes.includes(preference)) {
    return [preference]
  }

  return env.stripePaymentMethodTypes
}

async function markRegistrationAsConfirmed(paymentIntent: Stripe.PaymentIntent) {
  const registration = await Registration.findOne({ stripePaymentIntentId: paymentIntent.id })

  if (!registration) {
    return
  }

  const wasAlreadyConfirmed = registration.status === 'confirmed'

  registration.status = 'confirmed'
  registration.paymentMethod = mapStripeMethodType(paymentIntent.payment_method_types?.[0])
  registration.stripePaymentMethodType = paymentIntent.payment_method_types?.[0] || registration.stripePaymentMethodType
  registration.paidAt = new Date()
  await registration.save()

  if (!wasAlreadyConfirmed) {
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'payment_confirmed',
      actorRole: 'system',
      description: 'Pagamento confirmado automaticamente via webhook do Stripe.',
    })
  }

  if (!wasAlreadyConfirmed) {
    const eventDocument = await Event.findById(registration.event)

    if (eventDocument) {
      const ticket = eventDocument.ticketTypes.find((currentTicket) => currentTicket._id?.toString() === registration.selection.ticketTypeId)

      if (ticket) {
        ticket.sold += 1
        eventDocument.markModified('ticketTypes')
        await eventDocument.save()
      }
    }

    try {
      const populatedRegistration = await findRegistrationWithEvent(registration._id.toString())

      if (populatedRegistration) {
        await sendRegistrationConfirmation(populatedRegistration)
      }
    } catch (error) {
      console.error('[registration-confirmation-email]', error)
    }
  }
}

async function updateRegistrationStatus(paymentIntentId: string, status: 'processing_payment' | 'payment_failed' | 'cancelled', paymentMethodType?: string) {
  const registration = await Registration.findOne({ stripePaymentIntentId: paymentIntentId })

  if (!registration) {
    return
  }

  registration.status = status
  registration.paymentMethod = mapStripeMethodType(paymentMethodType)
  registration.stripePaymentMethodType = paymentMethodType || registration.stripePaymentMethodType
  await registration.save()

  if (status === 'cancelled') {
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'cancelled',
      actorRole: 'system',
      description: 'Pagamento cancelado automaticamente antes da confirmação da inscrição.',
    })
  }
}

async function markRegistrationAsRefunded(paymentIntentId: string, refundId?: string, amountInCents?: number) {
  const registration = await Registration.findOne({ stripePaymentIntentId: paymentIntentId })

  if (!registration) {
    return
  }

  const wasAlreadyReversed = registration.status === 'refunded' || registration.status === 'cancelled'
  const wasConfirmed = registration.status === 'confirmed'

  registration.status = 'refunded'
  registration.refundedAt = new Date()
  registration.cancelledAt = registration.cancelledAt || new Date()
  registration.refundAmount = amountInCents ? Number((amountInCents / 100).toFixed(2)) : registration.totalAmount
  registration.stripeRefundId = refundId || registration.stripeRefundId
  await registration.save()

  await appendRegistrationHistoryEntry(registration._id, {
    action: 'refund_processed',
    actorRole: 'system',
    description: 'Estorno confirmado automaticamente por webhook do Stripe.',
    refundAmount: registration.refundAmount,
    refundPercent: registration.totalAmount > 0 ? Number(((registration.refundAmount / registration.totalAmount) * 100).toFixed(2)) : 0,
    stripeRefundId: registration.stripeRefundId,
  })

  if (!wasAlreadyReversed && wasConfirmed) {
    const populatedRegistration = await findRegistrationWithEvent(registration._id.toString())

    if (populatedRegistration) {
      await releaseRegistrationCapacity(populatedRegistration)

      try {
        await sendRegistrationReversalCommunication({
          ...populatedRegistration,
          status: 'refunded',
          refundedAt: registration.refundedAt,
          cancelledAt: registration.cancelledAt,
          refundAmount: registration.refundAmount,
          cancellationReason: registration.cancellationReason,
        })
      } catch (error) {
        console.error('[registration-refund-email]', error)
      }
    }
  }
}

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Faça login para concluir a inscrição.' })
      return
    }

    if (!stripe) {
      res.status(500).json({ message: 'Stripe não configurado no backend.' })
      return
    }

    const payload = registrationCheckoutSchema.parse(req.body)
    const draft = await buildRegistrationCheckoutDraft(payload)

    if (draft.totalAmount <= 0) {
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
        requiresPayment: false,
        registration: serializeRegistration(registration),
      })
      return
    }

    const registration = await Registration.create({
      user: req.user._id,
      event: draft.event._id,
      orderNumber: generateOrderNumber(),
      buyerType: payload.buyerType,
      status: 'pending_payment',
      paymentMethod: 'stripe',
      subtotal: draft.subtotal,
      feeAmount: draft.feeAmount,
      totalAmount: draft.totalAmount,
      stripePaymentIntentId: '',
      stripePaymentMethodType: '',
      participant: payload.participant,
      selection: draft.selection,
      additionalAnswers: draft.answers,
      history: [],
    })

    await appendRegistrationHistoryEntry(registration._id, {
      action: 'created',
      actorRole: 'customer',
      actorUserId: req.user._id,
      description: 'Inscrição criada e enviada para processamento de pagamento.',
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(draft.totalAmount * 100),
      currency: 'brl',
      payment_method_types: resolvePaymentMethodTypes(payload.paymentMethodPreference),
      receipt_email: payload.participant.email,
      description: `${draft.event.title} • ${draft.selection.ticketName}`,
      metadata: {
        registrationId: registration._id.toString(),
        eventId: draft.event._id.toString(),
        ticketTypeId: draft.selection.ticketTypeId,
        batchId: draft.selection.batchId,
        userId: req.user._id.toString(),
      },
    })

    registration.stripePaymentIntentId = paymentIntent.id
    await registration.save()

    res.status(201).json({
      requiresPayment: true,
      clientSecret: paymentIntent.client_secret,
      registration: serializeRegistration(registration),
    })
  } catch (error) {
    next(error)
  }
}

export async function handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    if (!stripe || !env.stripeWebhookSecret) {
      res.status(500).json({ message: 'Stripe webhook não configurado.' })
      return
    }

    const signature = req.headers['stripe-signature']

    if (!signature) {
      res.status(400).json({ message: 'Assinatura do webhook ausente.' })
      return
    }

    const stripeEvent = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret)

    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        await markRegistrationAsConfirmed(stripeEvent.data.object)
        break
      case 'payment_intent.processing':
        await updateRegistrationStatus(
          stripeEvent.data.object.id,
          'processing_payment',
          stripeEvent.data.object.payment_method_types?.[0],
        )
        break
      case 'payment_intent.payment_failed':
        await updateRegistrationStatus(
          stripeEvent.data.object.id,
          'payment_failed',
          stripeEvent.data.object.payment_method_types?.[0],
        )
        break
      case 'payment_intent.canceled':
        await updateRegistrationStatus(
          stripeEvent.data.object.id,
          'cancelled',
          stripeEvent.data.object.payment_method_types?.[0],
        )
        break
      case 'charge.refunded':
        if (stripeEvent.data.object.payment_intent) {
          await markRegistrationAsRefunded(
            String(stripeEvent.data.object.payment_intent),
            stripeEvent.data.object.refunds?.data?.[0]?.id,
            stripeEvent.data.object.amount_refunded,
          )
        }
        break
      default:
        break
    }

    res.json({ received: true })
  } catch (error) {
    next(error)
  }
}