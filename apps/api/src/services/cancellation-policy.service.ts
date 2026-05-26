import { env } from '../config/env.js'

export interface EventCancellationPolicySettingsInput {
  fullRefundHoursBeforeEvent?: number | null
  partialRefundHoursBeforeEvent?: number | null
  partialRefundPercent?: number | null
}

export type RegistrationCancellationOutcome =
  | 'full_refund'
  | 'partial_refund'
  | 'no_refund'
  | 'cancel_only'
  | 'void_payment'

export interface RegistrationCancellationPolicySnapshot {
  summary: string
  currentRuleLabel: string
  outcome: RegistrationCancellationOutcome
  hoursUntilEvent: number
  currentRefundPercent: number
  currentRefundAmount: number
  fullRefundHoursBeforeEvent: number
  partialRefundHoursBeforeEvent: number
  partialRefundPercent: number
}

function normalizePolicySettings(settings?: EventCancellationPolicySettingsInput | null) {
  const fullRefundHours = Math.max(
    settings?.fullRefundHoursBeforeEvent ?? env.cancellationFullRefundHoursBeforeEvent,
    0,
  )
  const partialRefundHours = Math.min(
    Math.max(settings?.partialRefundHoursBeforeEvent ?? env.cancellationPartialRefundHoursBeforeEvent, 0),
    fullRefundHours,
  )
  const partialRefundPercent = Math.min(
    Math.max(settings?.partialRefundPercent ?? env.cancellationPartialRefundPercent, 0),
    100,
  )

  return {
    fullRefundHours,
    partialRefundHours,
    partialRefundPercent,
  }
}

function formatHoursAsWindow(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24
    return days === 1 ? '1 dia' : `${days} dias`
  }

  return hours === 1 ? '1 hora' : `${hours} horas`
}

export function buildCancellationPolicySummary(settings?: EventCancellationPolicySettingsInput | null) {
  const { fullRefundHours, partialRefundHours, partialRefundPercent } = normalizePolicySettings(settings)
  const parts = [`100% de estorno até ${formatHoursAsWindow(fullRefundHours)} antes do evento`]

  if (partialRefundPercent > 0 && partialRefundHours < fullRefundHours) {
    parts.push(`${partialRefundPercent}% de estorno até ${formatHoursAsWindow(partialRefundHours)} antes do evento`)
  }

  parts.push('após esse prazo, somente cancelamento sem estorno')

  return `Política automática do evento: ${parts.join(', ')}.`
}

export function buildRegistrationCancellationPolicy(
  eventStartDate: Date | string,
  totalAmount: number,
  status: string,
  settings?: EventCancellationPolicySettingsInput | null,
) {
  const { fullRefundHours, partialRefundHours, partialRefundPercent } = normalizePolicySettings(settings)
  const eventTimestamp = new Date(eventStartDate).getTime()
  const hoursUntilEvent = Number(((eventTimestamp - Date.now()) / (1000 * 60 * 60)).toFixed(2))
  const policySummary = buildCancellationPolicySummary(settings)

  if (status === 'pending_payment' || status === 'processing_payment') {
    return {
      summary: policySummary,
      currentRuleLabel: 'Se a inscrição for cancelada agora, o pagamento em aberto será interrompido sem estorno financeiro.',
      outcome: 'void_payment',
      hoursUntilEvent,
      currentRefundPercent: 0,
      currentRefundAmount: 0,
      fullRefundHoursBeforeEvent: fullRefundHours,
      partialRefundHoursBeforeEvent: partialRefundHours,
      partialRefundPercent,
    } satisfies RegistrationCancellationPolicySnapshot
  }

  if (totalAmount <= 0) {
    return {
      summary: policySummary,
      currentRuleLabel: 'Se a inscrição for cancelada agora, a vaga será liberada sem estorno financeiro porque não houve cobrança.',
      outcome: 'cancel_only',
      hoursUntilEvent,
      currentRefundPercent: 0,
      currentRefundAmount: 0,
      fullRefundHoursBeforeEvent: fullRefundHours,
      partialRefundHoursBeforeEvent: partialRefundHours,
      partialRefundPercent,
    } satisfies RegistrationCancellationPolicySnapshot
  }

  if (hoursUntilEvent >= fullRefundHours) {
    return {
      summary: policySummary,
      currentRuleLabel: 'Se a inscrição for cancelada agora, o estorno será integral.',
      outcome: 'full_refund',
      hoursUntilEvent,
      currentRefundPercent: 100,
      currentRefundAmount: Number(totalAmount.toFixed(2)),
      fullRefundHoursBeforeEvent: fullRefundHours,
      partialRefundHoursBeforeEvent: partialRefundHours,
      partialRefundPercent,
    } satisfies RegistrationCancellationPolicySnapshot
  }

  if (partialRefundPercent > 0 && hoursUntilEvent >= partialRefundHours) {
    const partialAmount = Number(((totalAmount * partialRefundPercent) / 100).toFixed(2))

    return {
      summary: policySummary,
      currentRuleLabel: `Se a inscrição for cancelada agora, o estorno será parcial de ${partialRefundPercent}%.`,
      outcome: 'partial_refund',
      hoursUntilEvent,
      currentRefundPercent: partialRefundPercent,
      currentRefundAmount: partialAmount,
      fullRefundHoursBeforeEvent: fullRefundHours,
      partialRefundHoursBeforeEvent: partialRefundHours,
      partialRefundPercent,
    } satisfies RegistrationCancellationPolicySnapshot
  }

  return {
    summary: policySummary,
    currentRuleLabel: 'Se a inscrição for cancelada agora, a política automática permite somente cancelamento sem estorno.',
    outcome: 'no_refund',
    hoursUntilEvent,
    currentRefundPercent: 0,
    currentRefundAmount: 0,
    fullRefundHoursBeforeEvent: fullRefundHours,
    partialRefundHoursBeforeEvent: partialRefundHours,
    partialRefundPercent,
  } satisfies RegistrationCancellationPolicySnapshot
}