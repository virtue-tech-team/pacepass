export type Role = 'super_admin' | 'event_admin' | 'customer'

export interface User {
  id: string
  name: string
  email: string
  username?: string
  isEmailVerified: boolean
  role: Role
  platformFeePercent: number
  phone: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  createdAt: string
}

export interface ManagedByUser {
  _id?: string
  id?: string
  name: string
  email: string
  role: Role
  platformFeePercent?: number
}

export interface EventBatch {
  _id?: string
  name: string
  startAt: string
  endAt: string
  price: number
  quantity: number
  status: 'scheduled' | 'active' | 'closed'
}

export interface EventStravaRoute {
  title: string
  url: string
  embedCode: string
}

export interface EventAdditionalQuestion {
  _id?: string
  label: string
  type: 'text' | 'select' | 'checkbox' | 'number'
  required: boolean
  helperText: string
  placeholder: string
  options: string[]
}

export interface TicketType {
  _id?: string
  groupId: string
  groupName: string
  name: string
  description: string
  price: number
  fee: number
  quantity: number
  sold?: number
  additionalQuestions: EventAdditionalQuestion[]
  batches: EventBatch[]
}

export interface EventItem {
  _id: string
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
  startDate: string
  endDate: string
  status: 'draft' | 'published' | 'closed'
  organizer: {
    name: string
    contactEmail: string
    contactPhone: string
  }
  pageSections: {
    aboutEvent: string
    routes: string
    registrations: string
    kitDelivery: string
    awards: string
    schedule: string
    regulation: string
    stravaRoutes: EventStravaRoute[]
    stravaEmbedUrl: string
  }
  operationalDetails: {
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
  cancellationPolicySummary?: string
  ticketTypes: TicketType[]
  highlights: string[]
  managedBy?: ManagedByUser | string
}

export interface RegistrationHistoryEntry {
  _id?: string
  action: 'created' | 'payment_confirmed' | 'receipt_resent' | 'cancelled' | 'refund_processed' | 'email_sent' | 'email_failed'
  actorRole: 'system' | 'customer' | 'event_admin' | 'super_admin'
  actorUserId?: string | null
  description: string
  reason: string
  emailType: string
  refundAmount: number
  refundPercent: number
  stripeRefundId: string
  createdAt: string
}

export interface RegistrationCancellationPolicySnapshot {
  summary: string
  currentRuleLabel: string
  outcome: 'full_refund' | 'partial_refund' | 'no_refund' | 'cancel_only' | 'void_payment'
  hoursUntilEvent: number
  currentRefundPercent: number
  currentRefundAmount: number
  fullRefundHoursBeforeEvent: number
  partialRefundHoursBeforeEvent: number
  partialRefundPercent: number
}

export interface DashboardSummary {
  role: Role
  users: number
  events: number
  publishedEvents: number
  upcomingEvents: EventItem[]
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface FinancialSummaryEventItem {
  eventId: string
  eventTitle: string
  eventDate: string
  city: string
  state: string
  status: EventItem['status']
  confirmedCount: number
  pendingCount: number
  cancelledCount: number
  refundedCount: number
  failedCount: number
  organizerGross: number
  platformFees: number
  buyerCharged: number
  refundedTotal: number
  organizerNet: number
  platformNet: number
  registrationsCount: number
}

export interface FinancialSummaryResponse {
  totals: {
    confirmedCount: number
    pendingCount: number
    cancelledCount: number
    refundedCount: number
    failedCount: number
    organizerGross: number
    platformFees: number
    buyerCharged: number
    refundedTotal: number
    organizerNet: number
    platformNet: number
  }
  events: FinancialSummaryEventItem[]
}

export interface OperationsChecklistItem {
  key: string
  label: string
  status: 'ready' | 'attention'
  detail: string
}

export interface OperationsAuditItem {
  registrationId: string
  orderNumber: string
  eventTitle: string
  action: RegistrationHistoryEntry['action']
  actorRole: Exclude<RegistrationHistoryEntry['actorRole'], 'system' | 'customer'>
  description: string
  createdAt: string
}

export interface OperationsReadinessResponse {
  health: {
    api: 'up'
    database: 'up' | 'connecting' | 'down'
  }
  integrations: {
    stripeConfigured: boolean
    stripeWebhookConfigured: boolean
    emailEnabled: boolean
    emailProvider: string
    brevoConfigured: boolean
    clientUrlConfigured: boolean
    clientUrl: string
  }
  activity: {
    latestWebhookActivityAt: string | null
    latestEmailActivityAt: string | null
    emailFailuresLast24h: number
  }
  checklist: OperationsChecklistItem[]
  recentAdminAudit: OperationsAuditItem[]
}

export interface CreateEventRequestInput {
  fullName: string
  email: string
  phone: string
  company: string
  region: string
  sportCategory:
    | 'road_running'
    | 'cycling'
    | 'obstacle_race'
    | 'kids_race'
    | 'canoeing'
    | 'virtual_challenges'
    | 'swimming'
    | 'trail_run'
    | 'triathlon'
    | 'surf'
    | 'courses'
    | 'other_sports'
    | 'other_events'
  eventsPerYear: '1' | '2_4' | '5_10' | '10_plus'
  eventName: string
  regulationStatus: 'ready' | 'not_ready' | 'need_help'
  preferredMonth:
    | 'january'
    | 'february'
    | 'march'
    | 'april'
    | 'may'
    | 'june'
    | 'july'
    | 'august'
    | 'september'
    | 'october'
    | 'november'
    | 'december'
    | 'not_defined'
  referralName: string
}

export interface EventRequestItem {
  _id: string
  fullName: string
  email: string
  phone: string
  company: string
  region: string
  sportCategory: CreateEventRequestInput['sportCategory']
  eventsPerYear: CreateEventRequestInput['eventsPerYear']
  eventName: string
  regulationStatus: CreateEventRequestInput['regulationStatus']
  preferredMonth: CreateEventRequestInput['preferredMonth']
  referralName: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  updatedAt: string
}

export interface PresignedUploadData {
  uploadUrl: string
  publicUrl: string
  key: string
}

export interface EventFormValues {
  title: string
  category: EventItem['category']
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
  startDate: string
  endDate: string
  status: EventItem['status']
  organizer: {
    name: string
    contactEmail: string
    contactPhone: string
  }
  pageSections: EventItem['pageSections']
  operationalDetails: EventItem['operationalDetails']
  managedBy?: string
  highlights: string[]
  ticketTypes: TicketType[]
}

export interface RegistrationAnswerInput {
  questionId: string
  answer: string
}

export interface RegistrationParticipant {
  fullName: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  email: string
  phone: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  emergencyContact: string
  profession: string
  team: string
  company: string
  privacyAccepted: boolean
}

export interface RegistrationItem {
  _id: string
  orderNumber: string
  status: 'pending_payment' | 'processing_payment' | 'confirmed' | 'payment_failed' | 'cancelled' | 'refunded'
  paymentMethod: 'stripe' | 'pix' | 'credit_card'
  subtotal: number
  feeAmount: number
  totalAmount: number
  buyerType: 'self' | 'third_party'
  participant: RegistrationParticipant
  selection: {
    groupId: string
    groupName: string
    ticketTypeId: string
    ticketName: string
    batchId: string
    batchName: string
  }
  event: {
    _id: string
    title: string
    slug: string
    startDate: string
    city: string
    state: string
    venue: string
    coverImage: string
  }
  createdAt: string
  paidAt?: string | null
  cancelledAt?: string | null
  refundedAt?: string | null
  cancellationReason: string
  refundAmount: number
  cancellationPolicy: RegistrationCancellationPolicySnapshot | null
  history: RegistrationHistoryEntry[]
}

export interface CreateRegistrationInput {
  eventId: string
  ticketTypeId: string
  batchId: string
  buyerType: 'self' | 'third_party'
  participant: RegistrationParticipant
  additionalAnswers: RegistrationAnswerInput[]
}

export interface CreateStripePaymentIntentInput extends CreateRegistrationInput {
  paymentMethodPreference?: 'card' | 'pix'
}

export interface UpdateMyProfileInput {
  name: string
  email: string
  phone: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  currentPassword?: string
  newPassword?: string
}

export interface UpdateUserCommercialSettingsInput {
  platformFeePercent: number
}

export interface CreateEventAdminInput {
  name: string
  email: string
  username: string
  password: string
  phone: string
  platformFeePercent: number
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
}

export type RegistrationHistoryActionFilter =
  | 'all'
  | 'created'
  | 'payment_confirmed'
  | 'receipt_resent'
  | 'cancelled'
  | 'refund_processed'
  | 'email_sent'
  | 'email_failed'

export type RegistrationHistoryActorFilter = 'all' | RegistrationHistoryEntry['actorRole']

export type SupportSearchParams = {
  q?: string
  status?: string
  eventId?: string
  paymentMethod?: string
  historyAction?: string
  page?: number
  limit?: number
}