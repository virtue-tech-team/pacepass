import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { StripeEmbeddedPaymentForm } from '../components/StripeEmbeddedPaymentForm'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import type { EventAdditionalQuestion, EventBatch, EventItem, RegistrationItem, TicketType } from '../types'

type CheckoutStage = 'modalidades' | 'identificacao' | 'ficha' | 'pagamento' | 'confirmacao'
type BuyerType = 'self' | 'third_party'

interface ParticipantFormState {
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

interface AdditionalAnswerMap {
  [key: string]: string
}

type CheckoutPaymentOption = 'pix' | 'card' | 'google_pay' | 'apple_pay'

interface PaymentOptionDefinition {
  key: CheckoutPaymentOption
  label: string
}

const checkoutSteps = [
  { key: 'modalidades', label: 'MODALIDADES' },
  { key: 'identificacao', label: 'IDENTIFICAÇÃO' },
  { key: 'ficha', label: 'FICHA DE INSCRIÇÃO' },
  { key: 'pagamento', label: 'FINALIZAÇÃO' },
] as const

const stripeVisiblePaymentMethods = new Set(
  (import.meta.env.VITE_STRIPE_PAYMENT_METHOD_TYPES || 'card')
    .split(',')
    .map((item: string) => item.trim().toLowerCase())
    .filter((item: string) => item.length > 0),
)

const paymentOptions: PaymentOptionDefinition[] = [
  ...(stripeVisiblePaymentMethods.has('pix')
    ? [{ key: 'pix', label: 'Pix' } satisfies PaymentOptionDefinition]
    : []),
  ...(stripeVisiblePaymentMethods.has('card')
    ? [
      { key: 'card', label: 'Cartão' } satisfies PaymentOptionDefinition,
      { key: 'google_pay', label: 'Google Pay' } satisfies PaymentOptionDefinition,
      { key: 'apple_pay', label: 'Apple Pay' } satisfies PaymentOptionDefinition,
    ]
    : []),
]

function normalizeCategoryName(value: string) {
  return value.replace(/^kit\b/i, 'Categoria')
}

function resolveDisplayBatch(ticket: TicketType) {
  const activeBatch = ticket.batches.find((batch) => batch.status === 'active')

  if (activeBatch) {
    return activeBatch
  }

  const scheduledBatch = [...ticket.batches]
    .filter((batch) => batch.status === 'scheduled')
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0]

  if (scheduledBatch) {
    return scheduledBatch
  }

  return [...ticket.batches].sort((left, right) => left.price - right.price)[0] ?? null
}

function isBatchCurrentlyOpen(batch: EventBatch, referenceDate = new Date()) {
  const startsAt = new Date(batch.startAt)
  const endsAt = new Date(batch.endAt)

  return batch.status === 'active' && startsAt.getTime() <= referenceDate.getTime() && endsAt.getTime() >= referenceDate.getTime()
}

function getBatchAvailabilityLabel(batch: EventBatch | null, referenceDate = new Date()) {
  if (!batch) {
    return 'Sem lote disponível agora'
  }

  if (batch.status === 'closed') {
    return 'Lote encerrado'
  }

  if (new Date(batch.startAt).getTime() > referenceDate.getTime()) {
    return 'Lote abre em breve'
  }

  if (new Date(batch.endAt).getTime() < referenceDate.getTime()) {
    return 'Lote encerrado'
  }

  return 'Disponível agora'
}

function resolveCheckoutBatch(ticket: TicketType) {
  return [...ticket.batches]
    .filter((batch) => isBatchCurrentlyOpen(batch))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0] ?? null
}

function resolveOrganizerFeePercent(event: EventItem | null) {
  if (!event || !event.managedBy || typeof event.managedBy === 'string') {
    return 0
  }

  return event.managedBy.platformFeePercent || 0
}

function calculatePlatformFee(subtotal: number, platformFeePercent: number) {
  return Number(((subtotal * platformFeePercent) / 100).toFixed(2))
}

function buildInitialParticipant(user: ReturnType<typeof useAuth>['user']): ParticipantFormState {
  return {
    fullName: user?.name || '',
    birthDate: user?.birthDate || '',
    gender: user?.gender || '',
    documentType: user?.documentType || 'CPF',
    document: user?.document || '',
    email: user?.email || '',
    phone: user?.phone || '',
    zipCode: user?.zipCode || '',
    country: user?.country || 'Brasil',
    state: user?.state || '',
    city: user?.city || '',
    addressLine: user?.addressLine || '',
    addressNumber: user?.addressNumber || '',
    emergencyContact: '',
    profession: '',
    team: '',
    company: '',
    privacyAccepted: false,
  }
}

function buildEmptyParticipant(): ParticipantFormState {
  return {
    fullName: '',
    birthDate: '',
    gender: '',
    documentType: 'CPF',
    document: '',
    email: '',
    phone: '',
    zipCode: '',
    country: 'Brasil',
    state: '',
    city: '',
    addressLine: '',
    addressNumber: '',
    emergencyContact: '',
    profession: '',
    team: '',
    company: '',
    privacyAccepted: false,
  }
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function mapPaymentOptionToPreference(option: CheckoutPaymentOption | null) {
  if (option === 'pix') {
    return 'pix' as const
  }

  return 'card' as const
}

function PaymentMethodIcon({ option }: { option: CheckoutPaymentOption }) {
  if (option === 'pix') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8.4 4.5a2 2 0 0 1 2.82 0l.78.78L9.3 8H8.1a2 2 0 0 1-1.41-.59L4.5 5.22l3.9-.72Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M15.6 4.5a2 2 0 0 0-2.82 0L12 5.28 14.7 8h1.2a2 2 0 0 0 1.41-.59l2.19-2.19-3.9-.72Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8.1 16H9.3L12 18.72l-1.38 1.38a2 2 0 0 1-2.83 0L4.5 16.78l3.6-.78Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M15.9 16h-1.2L12 18.72l1.38 1.38a2 2 0 0 0 2.83 0l3.29-3.32-3.6-.78Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )
  }

  if (option === 'card') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (option === 'google_pay') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4a8 8 0 1 0 5.66 13.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15 9h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 9l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15.1 4.5c.3 1.2-.1 2.4-.8 3.3-.8 1-2 1.6-3 1.5-.2-1.1.2-2.3.9-3.1.8-.9 2-1.6 2.9-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18.6 12.9c0 2.9 2.5 3.9 2.5 4 0 .1-.4 1.3-1.3 2.6-.8 1.1-1.7 2.2-3 2.2-1.2 0-1.6-.7-3-.7-1.4 0-1.8.7-3 .7-1.2 0-2.1-1.1-3-2.2-1.8-2.5-3.2-7.2-1.3-10.5 1-1.6 2.7-2.6 4.5-2.6 1.2 0 2.3.8 3 .8.7 0 2.1-1 3.6-.8.6 0 2.5.2 3.6 1.9-.1.1-2.6 1.5-2.6 4.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function renderQuestionField(
  question: EventAdditionalQuestion,
  value: string,
  onChange: (nextValue: string) => void,
) {
  if (question.type === 'select') {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {question.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    )
  }

  if (question.type === 'checkbox') {
    return (
      <label className="checkout-inline-option">
        <input type="checkbox" checked={value === 'yes'} onChange={(event) => onChange(event.target.checked ? 'yes' : '')} />
        <span>Selecionar</span>
      </label>
    )
  }

  return (
    <input
      type={question.type === 'number' ? 'number' : 'text'}
      value={value}
      placeholder={question.placeholder || ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function EventCheckoutPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const toast = useToast()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [buyerType, setBuyerType] = useState<BuyerType>('self')
  const [participant, setParticipant] = useState<ParticipantFormState>(() => buildInitialParticipant(user))
  const [answers, setAnswers] = useState<AdditionalAnswerMap>({})
  const [stage, setStage] = useState<CheckoutStage>('modalidades')
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false)
  const [createdRegistration, setCreatedRegistration] = useState<RegistrationItem | null>(null)
  const [zipLookupError, setZipLookupError] = useState('')
  const [isLookingUpZip, setIsLookingUpZip] = useState(false)
  const [paymentClientSecret, setPaymentClientSecret] = useState('')
  const [paymentRegistrationId, setPaymentRegistrationId] = useState('')
  const [isPreparingPayment, setIsPreparingPayment] = useState(false)
  const [shouldInitializePayment, setShouldInitializePayment] = useState(false)
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<CheckoutPaymentOption | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError('')

    api.getEventBySlug(slug)
      .then((response) => setEvent(response.event))
      .catch((currentError: Error) => setError(currentError.message))
      .finally(() => setIsLoading(false))
  }, [slug])

  useEffect(() => {
    if (buyerType === 'self') {
      setParticipant(buildInitialParticipant(user))
    }
  }, [buyerType, user])

  const ticketGroups = useMemo(() => {
    if (!event) {
      return [] as Array<{ groupId: string; groupName: string; tickets: TicketType[] }>
    }

    const groups = new Map<string, { groupId: string; groupName: string; tickets: TicketType[] }>()

    event.ticketTypes.forEach((ticket, index) => {
      const groupId = ticket.groupId || `group-${index}`
      const existing = groups.get(groupId)

      if (existing) {
        existing.tickets.push(ticket)
        return
      }

      groups.set(groupId, {
        groupId,
        groupName: normalizeCategoryName(ticket.groupName || `Categoria ${groups.size + 1}`),
        tickets: [ticket],
      })
    })

    return Array.from(groups.values())
  }, [event])

  const selectedGroup = ticketGroups.find((group) => group.groupId === selectedGroupId) || null
  const selectedTicket = event?.ticketTypes.find((ticket) => ticket._id === selectedTicketId) || event?.ticketTypes.find((ticket) => ticket.name === selectedTicketId) || null
  const selectedBatch = useMemo(() => (selectedTicket ? resolveCheckoutBatch(selectedTicket) : null), [selectedTicket])
  const selectedDisplayBatch = useMemo(() => (selectedTicket ? resolveDisplayBatch(selectedTicket) : null), [selectedTicket])
  const subtotal = selectedBatch?.price || 0
  const organizerFeePercent = resolveOrganizerFeePercent(event)
  const feeAmount = calculatePlatformFee(subtotal, organizerFeePercent)
  const totalAmount = subtotal + feeAmount
  const currentVisualStep = stage === 'confirmacao' ? 'pagamento' : stage

  function handleBuyerTypeChange(nextBuyerType: BuyerType) {
    setBuyerType(nextBuyerType)
    setZipLookupError('')

    if (nextBuyerType === 'third_party') {
      setParticipant(buildEmptyParticipant())
    }
  }

  function openGroup(groupId: string) {
    setSelectedGroupId(groupId)
    setSelectedTicketId('')
    setTermsAccepted(false)
  }

  function chooseTicket(ticket: TicketType) {
    setSelectedTicketId(ticket._id || ticket.name)
    setTermsAccepted(false)
    setStage('modalidades')
  }

  function proceedFromTerms() {
    if (!selectedTicket) {
      toast.error('Escolha uma modalidade antes de continuar para os termos.')
      return
    }

    if (!termsAccepted) {
      toast.error('Você precisa aceitar o termo de responsabilidade para continuar.')
      return
    }

    setStage('identificacao')
  }

  function proceedFromIdentification() {
    if (buyerType === 'self' && !user) {
      toast.error('Faça login para usar a inscrição para você ou escolha a opção de terceiro.')
      return
    }

    setStage('ficha')
  }

  async function handleZipLookup() {
    const digits = participant.zipCode.replace(/\D/g, '')

    if (digits.length !== 8) {
      const message = 'Informe um CEP com 8 dígitos para buscar o endereço.'
      setZipLookupError(message)
      toast.error(message)
      return
    }

    setIsLookingUpZip(true)
    setZipLookupError('')

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = (await response.json()) as {
        erro?: boolean
        logradouro?: string
        localidade?: string
        uf?: string
      }

      if (!response.ok || data.erro) {
        throw new Error('CEP não encontrado.')
      }

      setParticipant((current) => ({
        ...current,
        zipCode: formatZipCode(digits),
        addressLine: data.logradouro || current.addressLine,
        city: data.localidade || current.city,
        state: data.uf || current.state,
        country: current.country || 'Brasil',
      }))
      toast.success('Endereço preenchido a partir do CEP informado.')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Não foi possível consultar o CEP agora.'
      setZipLookupError(message)
      toast.error(message)
    } finally {
      setIsLookingUpZip(false)
    }
  }

  function proceedFromForm() {
    if (!selectedTicket || !selectedBatch) {
      toast.error('Escolha uma modalidade válida antes de avançar para o pagamento.')
      return
    }

    const missingRequiredQuestion = selectedTicket.additionalQuestions.find((question) => question.required && !answers[question._id || question.label]?.trim())

    if (!participant.fullName.trim()) {
      toast.error('Informe o nome completo do participante.')
      return
    }

    if (!participant.email.trim()) {
      toast.error('Informe o e-mail do participante.')
      return
    }

    if (!participant.phone.trim()) {
      toast.error('Informe o celular do participante.')
      return
    }

    if (!participant.privacyAccepted) {
      toast.error('Aceite a política de privacidade e as determinações da LGPD para continuar.')
      return
    }

    if (missingRequiredQuestion) {
      toast.error(`Responda a pergunta obrigatória: ${missingRequiredQuestion.label}.`)
      return
    }

    setSubmissionError('')
    setPaymentClientSecret('')
    setPaymentRegistrationId('')
    setSelectedPaymentOption(null)
    setShouldInitializePayment(false)
    setStage('pagamento')
  }

  function beginStripeCheckout() {
    if (!selectedPaymentOption) {
      const message = 'Escolha como deseja pagar para abrir o checkout seguro do Stripe.'
      setSubmissionError(message)
      toast.error(message)
      return
    }

    setSubmissionError('')
    setShouldInitializePayment(true)
  }

  function buildCheckoutPayload() {
    if (!event || !selectedTicket?._id || !selectedBatch?._id) {
      return null
    }

    return {
      eventId: event._id,
      ticketTypeId: selectedTicket._id,
      batchId: selectedBatch._id,
      buyerType,
      paymentMethodPreference: mapPaymentOptionToPreference(selectedPaymentOption),
      participant,
      additionalAnswers: selectedTicket.additionalQuestions
        .map((question) => ({
          questionId: question._id || question.label,
          answer: answers[question._id || question.label] || '',
        }))
        .filter((answer) => answer.answer.trim()),
    }
  }

  async function pollRegistrationStatus(registrationId: string) {
    if (!token) {
      throw new Error('Faça login para acompanhar o status da inscrição.')
    }

    let latestRegistration: RegistrationItem | null = null

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await api.getMyRegistration(token, registrationId)
      latestRegistration = response.registration

      if (['confirmed', 'processing_payment', 'payment_failed', 'cancelled'].includes(latestRegistration.status)) {
        return latestRegistration
      }

      if (latestRegistration.status === 'refunded') {
        return latestRegistration
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500))
    }

    if (!latestRegistration) {
      throw new Error('Não foi possível localizar a inscrição criada para o pagamento.')
    }

    return latestRegistration
  }

  async function handlePaymentResult(paymentIntentStatus: string) {
    if (!paymentRegistrationId) {
      const message = 'Não foi possível localizar a inscrição vinculada ao pagamento.'
      setSubmissionError(message)
      toast.error(message)
      return
    }

    setIsSubmittingRegistration(true)
    setSubmissionError('')

    try {
      const registration = await pollRegistrationStatus(paymentRegistrationId)

      if (paymentIntentStatus === 'succeeded' && registration.status === 'payment_failed') {
        throw new Error('O Stripe respondeu com pagamento concluído, mas a inscrição não foi confirmada corretamente.')
      }

      setCreatedRegistration(registration)

      if (registration.status === 'confirmed') {
        toast.success('Pagamento confirmado e inscrição concluída com sucesso.')
      } else if (registration.status === 'refunded') {
        toast.info('A inscrição foi revertida durante o processamento do pagamento.')
      } else if (registration.status === 'processing_payment') {
        toast.info('Pagamento recebido e em processamento. A confirmação será atualizada em instantes.')
      } else if (registration.status === 'payment_failed') {
        toast.error('O pagamento foi recusado. Revise os dados e tente novamente.')
      }

      setStage('confirmacao')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Não foi possível concluir a inscrição.'
      setSubmissionError(message)
      toast.error(message)
    } finally {
      setIsSubmittingRegistration(false)
    }
  }

  useEffect(() => {
    if (
      stage !== 'pagamento'
      || !token
      || !selectedPaymentOption
      || !shouldInitializePayment
      || isPreparingPayment
      || paymentClientSecret
      || createdRegistration
    ) {
      return
    }

    const payload = buildCheckoutPayload()

    if (!payload) {
      const message = 'Não foi possível preparar o pagamento da inscrição.'
      setSubmissionError(message)
      toast.error(message)
      return
    }

    setIsPreparingPayment(true)
    setShouldInitializePayment(false)
    setSubmissionError('')

    api.createStripePaymentIntent(token, payload)
      .then((response) => {
        setPaymentRegistrationId(response.registration._id)

        if (!response.requiresPayment) {
          setCreatedRegistration(response.registration)
          toast.success('Inscrição concluída com sucesso.')
          setStage('confirmacao')
          return
        }

        if (!response.clientSecret) {
          throw new Error('O Stripe não retornou o token necessário para renderizar o pagamento.')
        }

        setPaymentClientSecret(response.clientSecret)
      })
      .catch((currentError: Error) => {
        const message = currentError.message || 'Não foi possível iniciar o pagamento com Stripe.'
        setSubmissionError(message)
        toast.error(message)
      })
      .finally(() => {
        setIsPreparingPayment(false)
      })
  }, [stage, token, selectedPaymentOption, shouldInitializePayment, isPreparingPayment, paymentClientSecret, createdRegistration, buyerType, participant, answers, toast])

  function getRegistrationStatusLabel(status: RegistrationItem['status']) {
    switch (status) {
      case 'confirmed':
        return 'Confirmada'
      case 'processing_payment':
        return 'Pagamento em processamento'
      case 'pending_payment':
        return 'Aguardando pagamento'
      case 'payment_failed':
        return 'Pagamento falhou'
      case 'cancelled':
        return 'Cancelada'
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell">
        <section className="content-section compact-top section-surface">
          <div className="panel panel--plain">Carregando checkout...</div>
        </section>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="page-shell">
        <section className="content-section compact-top section-surface event-detail-empty">
          <div className="section-heading">
            <span className="eyebrow">Checkout</span>
            <h1>Não foi possível abrir a inscrição</h1>
            <p>{error || 'O evento não foi encontrado.'}</p>
          </div>
          <Link to="/eventos" className="primary-button">Voltar para eventos</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page-shell checkout-page">
      <section className="content-section compact-top checkout-shell">
        <header className="checkout-topbar">
          <button type="button" className="ghost-button" onClick={() => navigate(`/e/${event.slug}`)}>Voltar ao evento</button>
          <div>
            <strong>{event.title}</strong>
            <span>{formatDate(event.startDate)}</span>
          </div>
        </header>

        <nav className="checkout-progress" aria-label="Etapas do checkout">
          {checkoutSteps.map((step, index) => {
            const stepIndex = checkoutSteps.findIndex((item) => item.key === currentVisualStep)
            const status = index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'pending'

            return (
              <div key={step.key} className={`checkout-progress__item checkout-progress__item--${status}`}>
                <strong>{step.label}</strong>
              </div>
            )
          })}
        </nav>

        {stage === 'modalidades' ? (
          <div className="checkout-stage">
            {!selectedGroup ? (
              <div className="checkout-stage__panel">
                <div className="checkout-stage__heading">
                  <h1>Escolha uma categoria</h1>
                </div>
                <div className="checkout-group-list">
                  {ticketGroups.map((group) => (
                    <article key={group.groupId} className="checkout-group-card">
                      <div>
                        <h2>{group.groupName}</h2>
                        <p>{group.tickets.map((ticket) => ticket.name).join(' • ')}</p>
                      </div>
                      <button type="button" className="checkout-group-card__action" onClick={() => openGroup(group.groupId)}>+</button>
                    </article>
                  ))}
                </div>
              </div>
            ) : !selectedTicket ? (
              <div className="checkout-stage__panel">
                <div className="checkout-modal-header">
                  <div>
                    <strong>{selectedGroup?.groupName}</strong>
                    <span>Escolha uma das opções</span>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setSelectedGroupId('')}>Fechar</button>
                </div>
                <div className="checkout-option-list">
                  {selectedGroup?.tickets.map((ticket) => {
                    const batch = resolveDisplayBatch(ticket)
                    const checkoutBatch = resolveCheckoutBatch(ticket)
                    return (
                      <article key={ticket._id || ticket.name} className="checkout-option-card">
                        <div>
                          <strong>{ticket.name}</strong>
                          <span>{formatCurrency(batch?.price || 0)} + {organizerFeePercent}% de taxa de serviço</span>
                          <small>{getBatchAvailabilityLabel(checkoutBatch || batch)}</small>
                        </div>
                        <button type="button" className="primary-button" onClick={() => chooseTicket(ticket)} disabled={!checkoutBatch}>Escolher</button>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="checkout-stage__panel">
                <div className="checkout-stage__heading checkout-stage__heading--compact">
                  <div>
                    <strong>{selectedGroup?.groupName}</strong>
                    <h1>{selectedTicket.name}</h1>
                    <p>
                      {selectedBatch
                        ? `${formatCurrency(subtotal)} + ${organizerFeePercent}% de taxa de serviço (${formatCurrency(feeAmount)})`
                        : getBatchAvailabilityLabel(selectedDisplayBatch)}
                    </p>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setSelectedTicketId('')}>Trocar modalidade</button>
                </div>

                {!selectedBatch ? (
                  <div className="checkout-inline-warning">
                    <strong>Inscrições indisponíveis para esta modalidade.</strong>
                    <span>Esse lote não está ativo neste momento. Escolha outra modalidade ou volte mais perto da abertura das vendas.</span>
                  </div>
                ) : null}

                <div className="checkout-terms">
                  <p className="checkout-terms__alert">Role a tela e leia todos os nossos termos de compra. Para dar sequência você deve estar de acordo.</p>
                  <div className="checkout-terms__content">
                    <p>Declaro que estou apto fisicamente para participar do evento e assumo a responsabilidade pelas informações prestadas no cadastro.</p>
                    <p>Estou ciente de que a organização poderá aplicar as regras descritas no regulamento oficial e nas políticas do evento.</p>
                    <p>{event.pageSections.regulation || 'O regulamento completo será apresentado e confirmado nesta etapa do checkout.'}</p>
                    <p>{event.operationalDetails.cancellationPolicy || 'Não há devolução automática do valor de inscrição em caso de não participação.'}</p>
                  </div>
                  <p className="checkout-legal-links">
                    Revise também os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link> e a <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link> da plataforma antes de continuar.
                  </p>
                  <label className="checkout-checkbox">
                    <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                    <span>Li e concordo com o termo de responsabilidade, o regulamento do evento e as regras gerais da plataforma.</span>
                  </label>
                </div>

                <button type="button" className="primary-button checkout-action" onClick={proceedFromTerms} disabled={!termsAccepted || !selectedBatch}>Continuar</button>
              </div>
            )}
          </div>
        ) : null}

        {stage === 'identificacao' ? (
          <div className="checkout-stage">
            <div className="checkout-stage__panel">
              <div className="checkout-stage__heading">
                <h1>Para quem é a inscrição?</h1>
                <p>Escolha se essa compra é para você ou se está cadastrando um terceiro.</p>
              </div>

              <div className="checkout-choice-grid">
                <button type="button" className={`checkout-choice-card${buyerType === 'self' ? ' checkout-choice-card--active' : ''}`} onClick={() => handleBuyerTypeChange('self')}>
                  <strong>Essa inscrição é para mim</strong>
                  <span>{user ? `${user.name} • ${user.email}` : 'Faça login para usar seus dados automaticamente.'}</span>
                </button>
                <button type="button" className={`checkout-choice-card${buyerType === 'third_party' ? ' checkout-choice-card--active' : ''}`} onClick={() => handleBuyerTypeChange('third_party')}>
                  <strong>Inscrição para terceiros</strong>
                  <span>Você informa os dados do participante no próximo passo.</span>
                </button>
              </div>

              {buyerType === 'self' && !user ? (
                <div className="checkout-inline-warning">
                  <strong>Você ainda não está logado.</strong>
                  <span>Entre na sua conta para preencher automaticamente a inscrição “para mim” ou continue como terceiro.</span>
                </div>
              ) : null}

              <div className="checkout-form-section">
                <h2>Localização do participante</h2>
                {event?.cancellationPolicySummary ? (
                  <div className="checkout-inline-warning">
                    <strong>Política de cancelamento</strong>
                    <span>{event.cancellationPolicySummary}</span>
                  </div>
                ) : null}
                <div className="checkout-form-grid checkout-form-grid--triple">
                  <label>
                    <span>CEP</span>
                    <div className="input-with-action">
                      <input value={participant.zipCode} onChange={(event) => setParticipant((current) => ({ ...current, zipCode: formatZipCode(event.target.value) }))} placeholder="00000-000" inputMode="numeric" />
                      <button type="button" className="input-with-action__button" onClick={() => void handleZipLookup()} disabled={isLookingUpZip}>
                        {isLookingUpZip ? '...' : 'Buscar'}
                      </button>
                    </div>
                  </label>
                  <label>
                    <span>Estado</span>
                    <input value={participant.state} onChange={(event) => setParticipant((current) => ({ ...current, state: event.target.value }))} />
                  </label>
                  <label>
                    <span>Cidade</span>
                    <input value={participant.city} onChange={(event) => setParticipant((current) => ({ ...current, city: event.target.value }))} />
                  </label>
                </div>
                <div className="checkout-form-grid checkout-form-grid--double">
                  <label>
                    <span>Logradouro</span>
                    <input value={participant.addressLine} onChange={(event) => setParticipant((current) => ({ ...current, addressLine: event.target.value }))} />
                  </label>
                  <label>
                    <span>Número</span>
                    <input value={participant.addressNumber} onChange={(event) => setParticipant((current) => ({ ...current, addressNumber: event.target.value }))} />
                  </label>
                </div>
                {zipLookupError ? <div className="error-inline">{zipLookupError}</div> : null}
              </div>

              <button type="button" className="primary-button checkout-action" onClick={proceedFromIdentification} disabled={buyerType === 'self' && !user}>Continuar</button>
            </div>
          </div>
        ) : null}

        {stage === 'ficha' ? (
          <div className="checkout-stage">
            <div className="checkout-stage__panel">
              <div className="checkout-ticket-summary">
                <small>Modalidade</small>
                <strong>{selectedGroup?.groupName} - {selectedTicket?.name}</strong>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div className="checkout-form-section">
                <h2>Dados cadastrais do participante</h2>
                <div className="checkout-form-grid checkout-form-grid--triple">
                  <label>
                    <span>País</span>
                    <input value={participant.country} onChange={(event) => setParticipant((current) => ({ ...current, country: event.target.value }))} />
                  </label>
                  <label>
                    <span>Estado</span>
                    <input value={participant.state} onChange={(event) => setParticipant((current) => ({ ...current, state: event.target.value }))} />
                  </label>
                  <label>
                    <span>Cidade</span>
                    <input value={participant.city} onChange={(event) => setParticipant((current) => ({ ...current, city: event.target.value }))} />
                  </label>
                </div>

                <div className="checkout-form-grid checkout-form-grid--double">
                  <label>
                    <span>Nome completo</span>
                    <input value={participant.fullName} onChange={(event) => setParticipant((current) => ({ ...current, fullName: event.target.value }))} />
                  </label>
                  <label>
                    <span>Data de nascimento</span>
                    <input type="date" value={participant.birthDate} onChange={(event) => setParticipant((current) => ({ ...current, birthDate: event.target.value }))} />
                  </label>
                  <label>
                    <span>Gênero</span>
                    <select value={participant.gender} onChange={(event) => setParticipant((current) => ({ ...current, gender: event.target.value }))}>
                      <option value="">Selecione</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </label>
                  <label>
                    <span>Tipo de documento</span>
                    <select value={participant.documentType} onChange={(event) => setParticipant((current) => ({ ...current, documentType: event.target.value }))}>
                      <option value="CPF">CPF</option>
                      <option value="RG">RG</option>
                      <option value="Passaporte">Passaporte</option>
                    </select>
                  </label>
                  <label>
                    <span>Documento</span>
                    <input value={participant.document} onChange={(event) => setParticipant((current) => ({ ...current, document: event.target.value }))} />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input type="email" value={participant.email} onChange={(event) => setParticipant((current) => ({ ...current, email: event.target.value }))} />
                  </label>
                  <label>
                    <span>Celular</span>
                    <input value={participant.phone} onChange={(event) => setParticipant((current) => ({ ...current, phone: event.target.value }))} />
                  </label>
                </div>
              </div>

              <div className="checkout-form-section">
                <h2>Questionário</h2>
                <div className="checkout-form-grid checkout-form-grid--double">
                  <label>
                    <span>Sua equipe</span>
                    <input value={participant.team} onChange={(event) => setParticipant((current) => ({ ...current, team: event.target.value }))} />
                  </label>
                  <label>
                    <span>Contato em caso de emergência</span>
                    <input value={participant.emergencyContact} onChange={(event) => setParticipant((current) => ({ ...current, emergencyContact: event.target.value }))} />
                  </label>
                  <label>
                    <span>Qual a sua profissão?</span>
                    <input value={participant.profession} onChange={(event) => setParticipant((current) => ({ ...current, profession: event.target.value }))} />
                  </label>
                  <label>
                    <span>Em qual empresa trabalha?</span>
                    <input value={participant.company} onChange={(event) => setParticipant((current) => ({ ...current, company: event.target.value }))} />
                  </label>

                  {selectedTicket?.additionalQuestions.map((question) => (
                    <label key={question._id || question.label} className="checkout-question-field">
                      <span>{question.label}{question.required ? '*' : ''}</span>
                      {renderQuestionField(question, answers[question._id || question.label] || '', (nextValue) => setAnswers((current) => ({ ...current, [question._id || question.label]: nextValue })))}
                    </label>
                  ))}
                </div>
                <label className="checkout-checkbox">
                  <input type="checkbox" checked={participant.privacyAccepted} onChange={(event) => setParticipant((current) => ({ ...current, privacyAccepted: event.target.checked }))} />
                  <span>Autorizo o tratamento dos dados do participante conforme a <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link> e as bases legais da LGPD para processar a inscrição, pagamento e atendimento.</span>
                </label>
              </div>

              <div className="checkout-form-actions">
                <button type="button" className="ghost-button" onClick={() => setStage('identificacao')}>Voltar</button>
                <button type="button" className="primary-button" onClick={proceedFromForm}>Finalizar compra</button>
              </div>
            </div>
          </div>
        ) : null}

        {stage === 'pagamento' ? (
          <div className="checkout-stage checkout-stage--split">
            <div className="checkout-stage__panel">
              <div className="checkout-stage__heading checkout-stage__heading--compact">
                <div>
                  <h1>Resumo da inscrição</h1>
                  <p>Escolha como deseja pagar e só então abrimos o checkout seguro do Stripe dentro da plataforma.</p>
                </div>
              </div>

              <div className="checkout-summary-table">
                <div><span>Inscrição</span><strong>{formatCurrency(subtotal)}</strong></div>
                <div><span>Taxa de serviço ({organizerFeePercent}%)</span><strong>{formatCurrency(feeAmount)}</strong></div>
                <div><span>Desconto total</span><strong>{formatCurrency(0)}</strong></div>
                <div className="checkout-summary-table__total"><span>Valor total</span><strong>{formatCurrency(totalAmount)}</strong></div>
              </div>

              {!paymentClientSecret ? (
                <div className="checkout-form-section">
                  <h2>Escolha o método de pagamento</h2>
                  <div className="checkout-payment-options-list">
                    {paymentOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`panel checkout-payment-option ${selectedPaymentOption === option.key ? 'checkout-payment-option--active' : ''}`}
                        onClick={() => {
                          setSelectedPaymentOption(option.key)
                          setSubmissionError('')
                        }}
                        disabled={isPreparingPayment}
                      >
                        <span className={`checkout-payment-option__icon checkout-payment-option__icon--${option.key}`}>
                          <PaymentMethodIcon option={option.key} />
                        </span>
                        <span className="checkout-payment-option__content">
                          <strong>{option.label}</strong>
                        </span>
                        <span className="checkout-payment-option__indicator" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isPreparingPayment ? <div className="panel panel--plain">Preparando o pagamento seguro...</div> : null}
              {submissionError ? <div className="error-inline">{submissionError}</div> : null}

              {!paymentClientSecret ? (
                <button
                  type="button"
                  className="primary-button checkout-action"
                  onClick={beginStripeCheckout}
                  disabled={isPreparingPayment || !selectedPaymentOption}
                >
                  {isPreparingPayment ? 'Abrindo checkout seguro...' : 'Continuar para o pagamento'}
                </button>
              ) : null}

              {paymentClientSecret ? (
                <StripeEmbeddedPaymentForm clientSecret={paymentClientSecret} onPaymentResult={handlePaymentResult} />
              ) : null}

              <div className="checkout-form-actions">
                <button type="button" className="ghost-button" onClick={() => setStage('ficha')}>Voltar</button>
                {isSubmittingRegistration ? <div className="panel panel--plain">Aguardando a confirmação do pagamento...</div> : null}
              </div>
            </div>

            <aside className="checkout-side-summary">
              <div className="panel checkout-side-summary__card">
                {event.coverImage ? (
                  <div className="checkout-side-summary__media">
                    <img src={event.coverImage} alt={event.title} />
                  </div>
                ) : null}
                <div className="checkout-side-summary__header">
                  <span className="checkout-side-summary__eyebrow">Resumo da inscrição</span>
                  <strong>{event.title}</strong>
                </div>
                <div className="checkout-side-summary__metrics">
                  <div>
                    <span>Categoria</span>
                    <strong>{selectedGroup?.groupName || '-'}</strong>
                  </div>
                  <div>
                    <span>Modalidade</span>
                    <strong>{selectedTicket?.name || '-'}</strong>
                  </div>
                  <div>
                    <span>Lote</span>
                    <strong>{selectedBatch?.name || selectedDisplayBatch?.name || '-'}</strong>
                  </div>
                </div>
                <div className="checkout-side-summary__total">
                  <span>Total a pagar</span>
                  <strong>{formatCurrency(totalAmount)}</strong>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {stage === 'confirmacao' ? (
          <div className="checkout-stage checkout-stage--split">
            <div className="checkout-stage__panel">
              <div className="checkout-stage__heading checkout-stage__heading--compact">
                <div>
                  <h1>Inscrição confirmada</h1>
                  <p>A inscrição foi registrada com sucesso. O histórico agora fica disponível na sua área logada.</p>
                </div>
              </div>

              <div className="checkout-confirmation-box">
                <strong>Inscrição #{createdRegistration?.orderNumber || '-'}</strong>
                <span>Status: {createdRegistration ? getRegistrationStatusLabel(createdRegistration.status) : '-'}</span>
                <span>Participante: {createdRegistration?.participant.fullName || participant.fullName}</span>
                <span>Lote: {createdRegistration?.selection.batchName || selectedBatch?.name || selectedDisplayBatch?.name || '-'}</span>
                <span>{createdRegistration?.paidAt ? `Paga em: ${formatDate(createdRegistration.paidAt)}` : `Criada em: ${createdRegistration?.createdAt ? formatDate(createdRegistration.createdAt) : '-'}`}</span>
                <span>Valor total: {formatCurrency(createdRegistration?.totalAmount || totalAmount)}</span>
              </div>

              <div className="checkout-form-actions">
                <Link className="ghost-button" to="/minhas-inscricoes">Ver minhas inscrições</Link>
                <Link className="primary-button" to={`/e/${event.slug}`}>Voltar ao evento</Link>
              </div>
            </div>

            <aside className="checkout-side-summary">
              <div className="panel checkout-side-summary__card">
                {event.coverImage ? (
                  <div className="checkout-side-summary__media">
                    <img src={event.coverImage} alt={event.title} />
                  </div>
                ) : null}
                <div className="checkout-side-summary__header">
                  <span className="checkout-side-summary__eyebrow">Resumo da compra</span>
                  <strong>{event.title}</strong>
                </div>
                <div className="checkout-side-summary__metrics">
                  <div>
                    <span>Categoria</span>
                    <strong>{createdRegistration?.selection.groupName || selectedGroup?.groupName || '-'}</strong>
                  </div>
                  <div>
                    <span>Modalidade</span>
                    <strong>{createdRegistration?.selection.ticketName || selectedTicket?.name || '-'}</strong>
                  </div>
                  <div>
                    <span>Lote</span>
                    <strong>{createdRegistration?.selection.batchName || selectedBatch?.name || selectedDisplayBatch?.name || '-'}</strong>
                  </div>
                </div>
                <div className="checkout-side-summary__total">
                  <span>Total a pagar</span>
                  <strong>{formatCurrency(createdRegistration?.totalAmount || totalAmount)}</strong>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  )
}
