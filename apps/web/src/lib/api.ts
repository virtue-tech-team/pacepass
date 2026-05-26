import type {
  CreateEventAdminInput,
  CreateRegistrationInput,
  CreateStripePaymentIntentInput,
  CreateEventRequestInput,
  DashboardSummary,
  EventFormValues,
  EventItem,
  EventRequestItem,
  FinancialSummaryResponse,
  OperationsReadinessResponse,
  PaginationMeta,
  PresignedUploadData,
  RegistrationItem,
  Role,
  SupportSearchParams,
  UpdateMyProfileInput,
  UpdateUserCommercialSettingsInput,
  User,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(data.message || 'Falha ao comunicar com a API.', response.status, data.code)
  }

  return data as T
}

async function downloadFile(path: string, token: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(data.message || 'Falha ao comunicar com a API.', response.status, data.code)
  }

  return response.blob()
}

export const api = {
  getEvents(params?: { city?: string; category?: string; status?: string }) {
    const searchParams = new URLSearchParams()

    if (params?.city) searchParams.set('city', params.city)
    if (params?.category) searchParams.set('category', params.category)
    if (params?.status) searchParams.set('status', params.status)

    const query = searchParams.toString()
    return apiRequest<{ events: EventItem[] }>(`/api/events${query ? `?${query}` : ''}`)
  },
  getEventBySlug(slug: string) {
    return apiRequest<{ event: EventItem }>(`/api/events/slug/${slug}`)
  },
  getEventById(eventId: string) {
    return apiRequest<{ event: EventItem }>(`/api/events/${eventId}`)
  },
  getDashboardSummary(token: string) {
    return apiRequest<{ summary: DashboardSummary }>('/api/dashboard/summary', {}, token)
  },
  getManagedEvents(token: string) {
    return apiRequest<{ events: EventItem[] }>('/api/dashboard/events', {}, token)
  },
  getFinancialSummary(token: string) {
    return apiRequest<FinancialSummaryResponse>('/api/dashboard/financial-summary', {}, token)
  },
  getOperationsReadiness(token: string) {
    return apiRequest<OperationsReadinessResponse>('/api/dashboard/operations-readiness', {}, token)
  },
  listUsers(token: string, role?: Role) {
    const query = role ? `?role=${role}` : ''
    return apiRequest<{ users: User[] }>(`/api/users${query}`, {}, token)
  },
  login(input: { mode: 'participant' | 'organizer'; identifier: string; password: string }) {
    return apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  register(input: {
    name: string
    email: string
    password: string
    phone: string
    acceptedTerms: boolean
    acceptedPrivacyPolicy: boolean
    acceptedLgpdConsent: boolean
  }) {
    return apiRequest<{ user: User; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  resendVerificationEmail(email: string) {
    return apiRequest<{ message: string }>('/api/auth/resend-verification-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },
  forgotPassword(input: { mode: 'participant' | 'organizer'; identifier: string }) {
    return apiRequest<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  resetPassword(token: string, password: string) {
    return apiRequest<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
  },
  verifyEmail(token: string) {
    const searchParams = new URLSearchParams({ token })
    return apiRequest<{ token: string; user: User; message: string }>(`/api/auth/verify-email?${searchParams.toString()}`)
  },
  me(token: string) {
    return apiRequest<{ user: User }>('/api/auth/me', {}, token)
  },
  submitEventRequest(payload: CreateEventRequestInput) {
    return apiRequest<{ request: { id: string; status: string }; message: string }>('/api/event-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listEventRequests(token: string) {
    return apiRequest<{ requests: EventRequestItem[] }>('/api/event-requests', {}, token)
  },
  updateEventRequestStatus(token: string, requestId: string, status: EventRequestItem['status']) {
    return apiRequest<{ request: EventRequestItem; message: string }>(`/api/event-requests/${requestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token)
  },
  createEventCoverUpload(token: string, payload: { filename: string; contentType: string }) {
    return apiRequest<PresignedUploadData>('/api/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        folder: 'events/covers',
      }),
    }, token)
  },
  async uploadFile(uploadUrl: string, file: File) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error('Falha ao enviar o arquivo para o bucket da AWS.')
    }
  },
  createEvent(token: string, payload: EventFormValues) {
    return apiRequest<{ event: EventItem }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  updateEvent(token: string, eventId: string, payload: EventFormValues) {
    return apiRequest<{ event: EventItem }>(`/api/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token)
  },
  updateEventStatus(token: string, eventId: string, status: EventItem['status']) {
    return apiRequest<{ event: EventItem }>(`/api/events/${eventId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token)
  },
  createRegistration(token: string, payload: CreateRegistrationInput) {
    return apiRequest<{ registration: RegistrationItem }>('/api/registrations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  createStripePaymentIntent(token: string, payload: CreateStripePaymentIntentInput) {
    return apiRequest<{
      requiresPayment: boolean
      clientSecret?: string | null
      registration: RegistrationItem
    }>('/api/payments/intents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  listMyRegistrations(token: string) {
    return apiRequest<{ registrations: RegistrationItem[] }>('/api/registrations/me', {}, token)
  },
  getMyRegistration(token: string, registrationId: string) {
    return apiRequest<{ registration: RegistrationItem }>(`/api/registrations/${registrationId}`, {}, token)
  },
  downloadRegistrationReceipt(token: string, registrationId: string) {
    return downloadFile(`/api/registrations/${registrationId}/receipt`, token)
  },
  resendRegistrationReceipt(token: string, registrationId: string) {
    return apiRequest<{ message: string }>(`/api/registrations/${registrationId}/resend-receipt`, {
      method: 'POST',
    }, token)
  },
  cancelRegistrationFromSupport(token: string, registrationId: string, payload: { reason?: string }) {
    return apiRequest<{ message: string; registration: RegistrationItem }>(`/api/registrations/${registrationId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  cancelMyRegistration(token: string, registrationId: string, payload: { reason?: string }) {
    return apiRequest<{ message: string; registration: RegistrationItem }>(`/api/registrations/${registrationId}/request-cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  searchSupportRegistrations(token: string, params?: SupportSearchParams) {
    const searchParams = new URLSearchParams()

    if (params?.q) searchParams.set('q', params.q)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.eventId) searchParams.set('eventId', params.eventId)
    if (params?.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod)
    if (params?.historyAction) searchParams.set('historyAction', params.historyAction)
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))

    const query = searchParams.toString()

    return apiRequest<{ registrations: RegistrationItem[]; pagination: PaginationMeta }>(`/api/registrations/support/search${query ? `?${query}` : ''}`, {}, token)
  },
  updateMyProfile(token: string, payload: UpdateMyProfileInput) {
    return apiRequest<{ user: User; message: string }>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token)
  },
  createEventAdmin(token: string, payload: CreateEventAdminInput) {
    return apiRequest<{ user: User; message: string }>('/api/users/event-admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token)
  },
  updateUserCommercialSettings(token: string, userId: string, payload: UpdateUserCommercialSettingsInput) {
    return apiRequest<{ user: User; message: string }>(`/api/users/${userId}/commercial-settings`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token)
  },
}