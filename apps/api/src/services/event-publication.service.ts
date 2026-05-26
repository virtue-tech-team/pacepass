export const publicEventStatuses = ['published', 'closed'] as const

export type PublicEventStatus = (typeof publicEventStatuses)[number]

export function isPublicEventStatus(status: string): status is PublicEventStatus {
  return publicEventStatuses.includes(status as PublicEventStatus)
}

export function buildPublicEventStatusFilter(status?: string) {
  if (status && isPublicEventStatus(status)) {
    return status
  }

  return { $in: publicEventStatuses }
}

export function isEventPubliclyVisible(event: { status: string }) {
  return isPublicEventStatus(event.status)
}