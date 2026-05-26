import type mongoose from 'mongoose'

import { Registration } from '../models/Registration.js'

export interface RegistrationHistoryEntryInput {
  action:
    | 'created'
    | 'payment_confirmed'
    | 'receipt_resent'
    | 'cancelled'
    | 'refund_processed'
    | 'email_sent'
    | 'email_failed'
  actorRole: 'system' | 'customer' | 'event_admin' | 'super_admin'
  actorUserId?: mongoose.Types.ObjectId | string | null
  description: string
  reason?: string
  emailType?: 'registration_confirmation' | 'receipt_resend' | 'registration_reversal'
  refundAmount?: number
  refundPercent?: number
  stripeRefundId?: string
}

export async function appendRegistrationHistoryEntry(registrationId: mongoose.Types.ObjectId | string, entry: RegistrationHistoryEntryInput) {
  await Registration.updateOne(
    { _id: registrationId },
    {
      $push: {
        history: {
          action: entry.action,
          actorRole: entry.actorRole,
          actorUserId: entry.actorUserId || null,
          description: entry.description,
          reason: entry.reason || '',
          emailType: entry.emailType || '',
          refundAmount: entry.refundAmount || 0,
          refundPercent: entry.refundPercent || 0,
          stripeRefundId: entry.stripeRefundId || '',
          createdAt: new Date(),
        },
      },
    },
  )
}