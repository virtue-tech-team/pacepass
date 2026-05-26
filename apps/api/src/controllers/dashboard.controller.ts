import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'

import { roles } from '../constants/roles.js'
import { env } from '../config/env.js'
import { Event } from '../models/Event.js'
import { Registration } from '../models/Registration.js'
import { User } from '../models/User.js'

function getManagedEventFilter(req: Request) {
  return req.user?.role === roles.eventAdmin ? { managedBy: req.user._id } : {}
}

function getManagedRegistrationFilter(req: Request, eventIds: mongoose.Types.ObjectId[]) {
  if (req.user?.role === roles.eventAdmin) {
    return { event: { $in: eventIds } }
  }

  return {}
}

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const baseFilters = getManagedEventFilter(req)

    const [events, publishedEvents, users] = await Promise.all([
      Event.countDocuments(baseFilters),
      Event.countDocuments({ ...baseFilters, status: 'published' }),
      req.user?.role === roles.superAdmin ? User.countDocuments() : Promise.resolve(0),
    ])

    const upcomingEvents = await Event.find(baseFilters)
      .sort({ startDate: 1 })
      .limit(4)
      .select('title city state startDate status category ticketTypes')
      .lean()

    res.json({
      summary: {
        role: req.user?.role,
        users,
        events,
        publishedEvents,
        upcomingEvents,
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getManagedEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = getManagedEventFilter(req)

    const events = await Event.find(filters)
      .populate('managedBy', 'name email role platformFeePercent')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ events })
  } catch (error) {
    next(error)
  }
}

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const eventFilters = getManagedEventFilter(req)
    const events = await Event.find(eventFilters)
      .populate('managedBy', 'name email role platformFeePercent')
      .sort({ startDate: 1 })
      .lean()

    const eventIds = events.map((event) => event._id as mongoose.Types.ObjectId)
    const registrations = await Registration.find(getManagedRegistrationFilter(req, eventIds))
      .select('event status subtotal feeAmount totalAmount refundAmount paymentMethod createdAt updatedAt')
      .lean()

    const eventMetrics = events.map((event) => {
      const eventRegistrations = registrations.filter((registration) => registration.event.toString() === event._id.toString())

      const confirmedSales = eventRegistrations.filter((registration) => ['confirmed', 'refunded'].includes(registration.status))
      const pending = eventRegistrations.filter((registration) => ['pending_payment', 'processing_payment'].includes(registration.status)).length
      const cancelled = eventRegistrations.filter((registration) => registration.status === 'cancelled').length
      const refundedCount = eventRegistrations.filter((registration) => registration.status === 'refunded').length
      const failed = eventRegistrations.filter((registration) => registration.status === 'payment_failed').length
      const organizerGross = confirmedSales.reduce((total, registration) => total + registration.subtotal, 0)
      const platformFees = confirmedSales.reduce((total, registration) => total + registration.feeAmount, 0)
      const buyerCharged = confirmedSales.reduce((total, registration) => total + registration.totalAmount, 0)
      const refundedTotal = eventRegistrations.reduce((total, registration) => total + (registration.refundAmount || 0), 0)

      const refundedBase = eventRegistrations.reduce((total, registration) => {
        if (!registration.refundAmount || registration.totalAmount <= 0) {
          return total
        }

        return total + Number(((registration.subtotal * registration.refundAmount) / registration.totalAmount).toFixed(2))
      }, 0)

      const refundedFees = eventRegistrations.reduce((total, registration) => {
        if (!registration.refundAmount || registration.totalAmount <= 0) {
          return total
        }

        return total + Number(((registration.feeAmount * registration.refundAmount) / registration.totalAmount).toFixed(2))
      }, 0)

      return {
        eventId: event._id,
        eventTitle: event.title,
        eventDate: event.startDate,
        city: event.city,
        state: event.state,
        status: event.status,
        confirmedCount: eventRegistrations.filter((registration) => registration.status === 'confirmed').length,
        pendingCount: pending,
        cancelledCount: cancelled,
        refundedCount,
        failedCount: failed,
        organizerGross: Number(organizerGross.toFixed(2)),
        platformFees: Number(platformFees.toFixed(2)),
        buyerCharged: Number(buyerCharged.toFixed(2)),
        refundedTotal: Number(refundedTotal.toFixed(2)),
        organizerNet: Number((organizerGross - refundedBase).toFixed(2)),
        platformNet: Number((platformFees - refundedFees).toFixed(2)),
        registrationsCount: eventRegistrations.length,
      }
    })

    const totals = eventMetrics.reduce(
      (accumulator, event) => ({
        confirmedCount: accumulator.confirmedCount + event.confirmedCount,
        pendingCount: accumulator.pendingCount + event.pendingCount,
        cancelledCount: accumulator.cancelledCount + event.cancelledCount,
        refundedCount: accumulator.refundedCount + event.refundedCount,
        failedCount: accumulator.failedCount + event.failedCount,
        organizerGross: Number((accumulator.organizerGross + event.organizerGross).toFixed(2)),
        platformFees: Number((accumulator.platformFees + event.platformFees).toFixed(2)),
        buyerCharged: Number((accumulator.buyerCharged + event.buyerCharged).toFixed(2)),
        refundedTotal: Number((accumulator.refundedTotal + event.refundedTotal).toFixed(2)),
        organizerNet: Number((accumulator.organizerNet + event.organizerNet).toFixed(2)),
        platformNet: Number((accumulator.platformNet + event.platformNet).toFixed(2)),
      }),
      {
        confirmedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        refundedCount: 0,
        failedCount: 0,
        organizerGross: 0,
        platformFees: 0,
        buyerCharged: 0,
        refundedTotal: 0,
        organizerNet: 0,
        platformNet: 0,
      },
    )

    res.json({
      totals,
      events: eventMetrics,
    })
  } catch (error) {
    next(error)
  }
}

export async function getOperationsReadiness(req: Request, res: Response, next: NextFunction) {
  try {
    const eventIds = await Event.find(getManagedEventFilter(req)).distinct('_id')
    const registrationFilter = getManagedRegistrationFilter(req, eventIds as mongoose.Types.ObjectId[])

    const [recentAdminAudit, recentEmailFailures, recentSystemActivity] = await Promise.all([
      Registration.aggregate([
        { $match: registrationFilter },
        { $unwind: '$history' },
        { $match: { 'history.actorRole': { $in: ['event_admin', 'super_admin'] } } },
        { $sort: { 'history.createdAt': -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'events',
            localField: 'event',
            foreignField: '_id',
            as: 'eventRecord',
          },
        },
        { $unwind: { path: '$eventRecord', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            orderNumber: 1,
            registrationId: '$_id',
            eventTitle: '$eventRecord.title',
            action: '$history.action',
            actorRole: '$history.actorRole',
            description: '$history.description',
            createdAt: '$history.createdAt',
          },
        },
      ]),
      Registration.aggregate([
        { $match: registrationFilter },
        { $unwind: '$history' },
        {
          $match: {
            'history.action': 'email_failed',
            'history.createdAt': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        { $count: 'count' },
      ]),
      Registration.aggregate([
        { $match: registrationFilter },
        { $unwind: '$history' },
        {
          $match: {
            'history.action': { $in: ['payment_confirmed', 'refund_processed', 'email_sent', 'email_failed'] },
          },
        },
        { $sort: { 'history.createdAt': -1 } },
        { $limit: 20 },
        {
          $project: {
            action: '$history.action',
            createdAt: '$history.createdAt',
          },
        },
      ]),
    ])

    const latestWebhookActivity = recentSystemActivity.find((entry) => ['payment_confirmed', 'refund_processed'].includes(entry.action))
    const latestEmailActivity = recentSystemActivity.find((entry) => ['email_sent', 'email_failed'].includes(entry.action))
    const databaseState = mongoose.connection.readyState
    const databaseStatus = databaseState === 1 ? 'up' : databaseState === 2 ? 'connecting' : 'down'
    const stripeConfigured = Boolean(env.stripeSecretKey)
    const stripeWebhookConfigured = Boolean(env.stripeWebhookSecret)
    const brevoConfigured = env.emailEnabled ? env.emailProvider !== 'brevo' || Boolean(env.brevoApiKey) : true
    const clientUrlConfigured = Boolean(env.clientUrl)

    const checklist = [
      {
        key: 'mongodb',
        label: 'MongoDB disponível',
        status: databaseStatus === 'up' ? 'ready' : 'attention',
        detail: databaseStatus === 'up' ? 'Conexão ativa com o banco.' : 'Banco indisponível ou reconectando.',
      },
      {
        key: 'stripe-secret',
        label: 'Stripe secret key',
        status: stripeConfigured ? 'ready' : 'attention',
        detail: stripeConfigured ? 'Backend apto a criar pagamentos.' : 'Configure STRIPE_SECRET_KEY.',
      },
      {
        key: 'stripe-webhook',
        label: 'Stripe webhook',
        status: stripeWebhookConfigured ? 'ready' : 'attention',
        detail: stripeWebhookConfigured ? 'Webhook autenticado com secret configurado.' : 'Configure STRIPE_WEBHOOK_SECRET.',
      },
      {
        key: 'brevo',
        label: 'Brevo / e-mail transacional',
        status: brevoConfigured ? 'ready' : 'attention',
        detail: brevoConfigured ? 'Envio transacional pronto para operação.' : 'Revise EMAIL_PROVIDER, EMAIL_ENABLED e BREVO_API_KEY.',
      },
      {
        key: 'client-url',
        label: 'URL pública do cliente',
        status: clientUrlConfigured ? 'ready' : 'attention',
        detail: clientUrlConfigured ? `CLIENT_URL configurada para ${env.clientUrl}.` : 'Configure CLIENT_URL para links públicos e e-mails.',
      },
    ]

    res.json({
      health: {
        api: 'up',
        database: databaseStatus,
      },
      integrations: {
        stripeConfigured,
        stripeWebhookConfigured,
        emailEnabled: env.emailEnabled,
        emailProvider: env.emailProvider,
        brevoConfigured,
        clientUrlConfigured,
        clientUrl: env.clientUrl,
      },
      activity: {
        latestWebhookActivityAt: latestWebhookActivity?.createdAt || null,
        latestEmailActivityAt: latestEmailActivity?.createdAt || null,
        emailFailuresLast24h: recentEmailFailures[0]?.count || 0,
      },
      checklist,
      recentAdminAudit,
    })
  } catch (error) {
    next(error)
  }
}