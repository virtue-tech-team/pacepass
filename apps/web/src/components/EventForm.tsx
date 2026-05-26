import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { isValidStravaEmbedValue } from '../lib/strava'
import type { EventAdditionalQuestion, EventBatch, EventFormValues, EventStravaRoute, TicketType, User } from '../types'

function formatHoursAsWindow(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24
    return days === 1 ? '1 dia' : `${days} dias`
  }

  return hours === 1 ? '1 hora' : `${hours} horas`
}

function buildPolicyPreview(values: EventFormValues['operationalDetails']['cancellationPolicySettings']) {
  const fullRefundHours = Math.max(values.fullRefundHoursBeforeEvent, 0)
  const partialRefundHours = Math.min(Math.max(values.partialRefundHoursBeforeEvent, 0), fullRefundHours)
  const partialRefundPercent = Math.min(Math.max(values.partialRefundPercent, 0), 100)
  const segments = [`100% até ${formatHoursAsWindow(fullRefundHours)}`]

  if (partialRefundPercent > 0 && partialRefundHours < fullRefundHours) {
    segments.push(`${partialRefundPercent}% até ${formatHoursAsWindow(partialRefundHours)}`)
  }

  segments.push('após isso, apenas cancelamento sem estorno')

  return `Política automática do evento: ${segments.join(', ')}.`
}

const steps = [
  { key: 'basics', label: 'Evento', description: 'Informações principais, data e capa.' },
  { key: 'page', label: 'Página', description: 'Seções públicas do evento.' },
  { key: 'organizer', label: 'Organização', description: 'Responsável e destaques do evento.' },
  { key: 'tickets', label: 'Categorias', description: 'Categorias, modalidades e lotes.' },
  { key: 'review', label: 'Revisão', description: 'Conferência final antes de salvar.' },
] as const

const createTicketGroupId = () => `category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const emptyAdditionalQuestion = (): EventAdditionalQuestion => ({
  label: '',
  type: 'text',
  required: false,
  helperText: '',
  placeholder: '',
  options: [],
})

const emptyBatch = (): EventBatch => ({
  name: '1º Lote',
  startAt: '',
  endAt: '',
  price: 0,
  quantity: 50,
  status: 'scheduled',
})

const emptyStravaRoute = (title = ''): EventStravaRoute => ({
  title,
  url: '',
  embedCode: '',
})

const emptyModality = (
  groupName = '',
  modalityName = 'Corrida 5km',
  groupId = createTicketGroupId(),
): TicketType => ({
  groupId,
  groupName,
  name: modalityName,
  description: '',
  price: 0,
  fee: 0,
  quantity: 100,
  additionalQuestions: [
    {
      ...emptyAdditionalQuestion(),
      label: 'Tamanho da camiseta',
      type: 'select',
      required: true,
      options: ['P', 'M', 'G'],
    },
  ],
  batches: [emptyBatch()],
})

const createEmptyValues = (): EventFormValues => ({
  title: '',
  category: 'running',
  description: '',
  contentHtml: '',
  zipCode: '',
  city: '',
  state: '',
  country: 'Brasil',
  venue: '',
  addressLine: '',
  addressNumber: '',
  mapUrl: '',
  coverImage: '',
  startDate: '',
  endDate: '',
  status: 'draft',
  organizer: {
    name: '',
    contactEmail: '',
    contactPhone: '',
  },
  pageSections: {
    aboutEvent: '',
    routes: '',
    registrations: '',
    kitDelivery: '',
    awards: '',
    schedule: '',
    regulation: '',
    stravaRoutes: [],
    stravaEmbedUrl: '',
  },
  operationalDetails: {
    regulationUrl: '',
    checkInNotes: '',
    cancellationPolicy: '',
    cancellationPolicySettings: {
      fullRefundHoursBeforeEvent: 72,
      partialRefundHoursBeforeEvent: 24,
      partialRefundPercent: 50,
    },
    kitSummary: '',
    additionalQuestions: '',
  },
  managedBy: '',
  highlights: [''],
  ticketTypes: [emptyModality()],
})

function resolveCategoryPrice(ticket: Pick<TicketType, 'batches'>) {
  const activeBatch = ticket.batches.find((batch) => batch.status === 'active')

  if (activeBatch) {
    return activeBatch.price
  }

  const scheduledBatch = [...ticket.batches]
    .filter((batch) => batch.status === 'scheduled')
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0]

  if (scheduledBatch) {
    return scheduledBatch.price
  }

  return ticket.batches.reduce((lowestPrice, batch) => Math.min(lowestPrice, batch.price), ticket.batches[0]?.price ?? 0)
}

export function EventForm({
  onSubmit,
  managers,
  isSubmitting,
  canAssignManager,
  initialValues,
}: {
  onSubmit: (values: EventFormValues) => Promise<void>
  managers: User[]
  isSubmitting: boolean
  canAssignManager: boolean
  initialValues?: EventFormValues | null
}) {
  const { token } = useAuth()
  const [values, setValues] = useState<EventFormValues>(() => createEmptyValues())
  const [currentStep, setCurrentStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [zipLookupError, setZipLookupError] = useState('')
  const [isLookingUpZip, setIsLookingUpZip] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({})
  const [questionOptionsDrafts, setQuestionOptionsDrafts] = useState<Record<string, string>>({})
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const coverPreview = useMemo(() => values.coverImage || '', [values.coverImage])
  const cancellationPolicyPreview = useMemo(
    () => buildPolicyPreview(values.operationalDetails.cancellationPolicySettings),
    [values.operationalDetails.cancellationPolicySettings],
  )

  useEffect(() => {
    if (!initialValues) {
      return
    }

    setValues({
      ...initialValues,
      pageSections: {
        ...initialValues.pageSections,
        stravaRoutes: initialValues.pageSections.stravaRoutes.length
          ? initialValues.pageSections.stravaRoutes.map((route) => ({
            title: route.title || '',
            url: route.url || '',
            embedCode: route.embedCode || '',
          }))
          : [],
      },
    })
    setCurrentStep(0)
    setStepError('')
    setUploadError('')
    setZipLookupError('')
    setNewCategoryName('')
    setNumericDrafts({})
    setQuestionOptionsDrafts({})
    setCollapsedCategories({})
  }, [initialValues])

  const ticketGroups = useMemo(() => {
    const groups = new Map<string, { groupId: string; groupName: string; ticketIndexes: number[] }>()

    values.ticketTypes.forEach((ticket, index) => {
      const groupId = ticket.groupId || `group-${index}`
      const current = groups.get(groupId)

      if (current) {
        current.ticketIndexes.push(index)
        return
      }

      groups.set(groupId, {
        groupId,
        groupName: ticket.groupName || `Categoria ${groups.size + 1}`,
        ticketIndexes: [index],
      })
    })

    return Array.from(groups.values())
  }, [values.ticketTypes])

  function isCategoryCollapsed(groupId: string) {
    return collapsedCategories[groupId] ?? false
  }

  function toggleCategory(groupId: string) {
    setCollapsedCategories((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? false),
    }))
  }

  function parseCommaSeparatedList(value: string) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  function getQuestionOptionsDraftKey(ticketIndex: number, questionIndex: number) {
    return `ticket-${ticketIndex}-question-${questionIndex}-options`
  }

  function getQuestionOptionsInputValue(ticketIndex: number, questionIndex: number, options: string[]) {
    const key = getQuestionOptionsDraftKey(ticketIndex, questionIndex)
    return questionOptionsDrafts[key] ?? options.join(', ')
  }

  function handleQuestionOptionsChange(ticketIndex: number, questionIndex: number, rawValue: string) {
    const key = getQuestionOptionsDraftKey(ticketIndex, questionIndex)

    setQuestionOptionsDrafts((current) => ({
      ...current,
      [key]: rawValue,
    }))

    updateAdditionalQuestionField(ticketIndex, questionIndex, 'options', parseCommaSeparatedList(rawValue))
  }

  function formatZipCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`
  }

  function buildMapUrl(nextValues: Pick<EventFormValues, 'venue' | 'addressLine' | 'addressNumber' | 'city' | 'state' | 'country'>) {
    const query = [nextValues.venue, nextValues.addressLine, nextValues.addressNumber, nextValues.city, nextValues.state, nextValues.country]
      .filter(Boolean)
      .join(', ')

    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
  }

  async function handleZipLookup() {
    const digits = values.zipCode.replace(/\D/g, '')

    if (digits.length !== 8) {
      setZipLookupError('Informe um CEP com 8 dígitos para buscar o endereço.')
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

      setValues((current) => {
        const nextValues = {
          ...current,
          zipCode: formatZipCode(digits),
          addressLine: data.logradouro || current.addressLine,
          city: data.localidade || current.city,
          state: data.uf || current.state,
          country: current.country || 'Brasil',
        }

        return {
          ...nextValues,
          mapUrl: current.mapUrl || buildMapUrl(nextValues),
        }
      })
    } catch (error) {
      setZipLookupError((error as Error).message || 'Não foi possível consultar o CEP agora.')
    } finally {
      setIsLookingUpZip(false)
    }
  }

  function getNumericInputValue(path: string, fallback: number) {
    return path in numericDrafts ? numericDrafts[path] : String(fallback)
  }

  function handleNumericInputChange(path: string, onValidChange: (value: number) => void, value: string) {
    setNumericDrafts((current) => ({
      ...current,
      [path]: value,
    }))

    const normalizedValue = value.replace(',', '.')
    const parsedValue = Number(normalizedValue)

    if (!Number.isNaN(parsedValue)) {
      onValidChange(parsedValue)
    }
  }

  function handleNumericInputBlur(path: string, fallback: number, onBlurCommit: (value: number) => void) {
    const currentValue = numericDrafts[path]

    if (currentValue === undefined) {
      return
    }

    const parsedValue = Number(currentValue.replace(',', '.'))
    onBlurCommit(Number.isNaN(parsedValue) ? fallback : parsedValue)

    setNumericDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[path]
      return nextDrafts
    })
  }

  function updateCategoryGroupName(groupId: string, groupName: string) {
    setValues((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.map((ticket) => (ticket.groupId === groupId ? { ...ticket, groupName } : ticket)),
    }))
  }

  function addCategoryGroup() {
    const groupName = newCategoryName.trim() || `Categoria ${ticketGroups.length + 1}`
    setValues((current) => ({
      ...current,
      ticketTypes: [...current.ticketTypes, emptyModality(groupName, 'Modalidade 1')],
    }))
    setNewCategoryName('')
  }

  function addModalityToGroup(groupId: string, groupName: string) {
    setValues((current) => {
      const nextIndex = current.ticketTypes.filter((ticket) => ticket.groupId === groupId).length + 1
      return {
        ...current,
        ticketTypes: [...current.ticketTypes, emptyModality(groupName, `Modalidade ${nextIndex}`, groupId)],
      }
    })
  }

  function removeCategoryGroup(groupId: string) {
    setValues((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.filter((ticket) => ticket.groupId !== groupId),
    }))
  }

  function updateTicketField(index: number, field: keyof TicketType, value: string | number) {
    setValues((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.map((ticket, ticketIndex) => (ticketIndex === index ? { ...ticket, [field]: value } : ticket)),
    }))
  }

  function updateAdditionalQuestionField(index: number, questionIndex: number, field: keyof EventAdditionalQuestion, value: string | boolean | string[]) {
    setValues((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.map((ticket, ticketIndex) =>
        ticketIndex === index
          ? {
              ...ticket,
              additionalQuestions: ticket.additionalQuestions.map((question, currentQuestionIndex) =>
                currentQuestionIndex === questionIndex ? { ...question, [field]: value } : question,
              ),
            }
          : ticket,
      ),
    }))
  }

  function updateBatchField(index: number, batchIndex: number, field: keyof EventBatch, value: string | number) {
    setValues((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.map((ticket, ticketIndex) =>
        ticketIndex === index
          ? {
              ...ticket,
              batches: ticket.batches.map((batch, currentBatchIndex) => (currentBatchIndex === batchIndex ? { ...batch, [field]: value } : batch)),
            }
          : ticket,
      ),
    }))
  }

  function validateStep(stepIndex: number) {
    if (stepIndex === 0) {
      if (!values.title || values.title.trim().length < 4) {
        return 'O título do evento deve ter pelo menos 4 caracteres.'
      }

      if (!values.description || values.description.trim().length < 10) {
        return 'A descrição do evento deve ter pelo menos 10 caracteres.'
      }

      if (!values.zipCode || !values.city || !values.state || !values.country || !values.venue || !values.addressLine || !values.addressNumber || !values.startDate || !values.endDate) {
        return 'Preencha os dados principais do evento antes de continuar.'
      }

      if (values.mapUrl && !/^https?:\/\//i.test(values.mapUrl)) {
        return 'Informe uma URL válida para o mapa do evento.'
      }
    }

    if (stepIndex === 1) {
      const hasPageContent = [
        values.pageSections.aboutEvent,
        values.pageSections.routes,
        values.pageSections.registrations,
        values.pageSections.kitDelivery,
        values.pageSections.awards,
        values.pageSections.schedule,
        values.pageSections.regulation,
      ].some(Boolean)

      if (!hasPageContent) {
        return 'Preencha pelo menos uma seção da página do evento.'
      }

      if (values.operationalDetails.regulationUrl && !/^https?:\/\//i.test(values.operationalDetails.regulationUrl)) {
        return 'Informe uma URL válida para o regulamento.'
      }

      const hasInvalidStravaRoute = values.pageSections.stravaRoutes.some((route) => {
        const hasPartialValue = route.title.trim() || route.url.trim() || route.embedCode.trim()

        if (!hasPartialValue) {
          return false
        }

        if (!route.title.trim()) {
          return true
        }

        if (route.url.trim() && !/^https?:\/\//i.test(route.url)) {
          return true
        }

        if (route.embedCode.trim() && !isValidStravaEmbedValue(route.embedCode)) {
          return true
        }

        return !route.url.trim() && !route.embedCode.trim()
      })

      if (hasInvalidStravaRoute) {
        return 'Preencha título e ao menos um link ou código de embed válido para cada percurso Strava adicionado.'
      }

      if (!isValidStravaEmbedValue(values.pageSections.stravaEmbedUrl)) {
        return 'Informe um link de rota do Strava ou cole o código oficial de embed do Strava.'
      }
    }

    if (stepIndex === 2) {
      if (!values.organizer.name || !values.organizer.contactEmail) {
        return 'Preencha os dados do organizador para seguir.'
      }
    }

    if (stepIndex === 3) {
      const hasInvalidTicket = values.ticketTypes.some((ticket) =>
        !ticket.groupId ||
        !ticket.groupName ||
        !ticket.name ||
        ticket.quantity <= 0 ||
        ticket.additionalQuestions.some((question) => !question.label || ((question.type === 'select' || question.type === 'checkbox') && question.options.filter(Boolean).length === 0)) ||
        ticket.batches.length === 0 ||
        ticket.batches.some((batch) => !batch.name || !batch.startAt || !batch.endAt || batch.quantity <= 0 || batch.price < 0),
      )

      if (hasInvalidTicket) {
        return 'Revise categorias, modalidades, perguntas adicionais e lotes antes de avançar.'
      }
    }

    return ''
  }

  async function handleCoverUpload(file: File) {
    if (!token) {
      setUploadError('Você precisa estar autenticado para enviar a capa.')
      return
    }

    setIsUploadingCover(true)
    setUploadError('')

    try {
      const upload = await api.createEventCoverUpload(token, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      })

      await api.uploadFile(upload.uploadUrl, file)

      setValues((current) => ({
        ...current,
        coverImage: upload.publicUrl,
      }))
    } catch (error) {
      setUploadError((error as Error).message)
    } finally {
      setIsUploadingCover(false)
    }
  }

  function goToNextStep() {
    const error = validateStep(currentStep)
    setStepError(error)

    if (!error) {
      setCurrentStep((step) => Math.min(step + 1, steps.length - 1))
    }
  }

  function goToPreviousStep() {
    setStepError('')
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const error = validateStep(0) || validateStep(1) || validateStep(2) || validateStep(3)
    if (error) {
      setStepError(error)
      return
    }

    await onSubmit({
      ...values,
      highlights: values.highlights.filter(Boolean),
      pageSections: {
        ...values.pageSections,
        stravaEmbedUrl: values.pageSections.stravaEmbedUrl.trim(),
        stravaRoutes: values.pageSections.stravaRoutes
          .map((route) => ({
            title: route.title.trim(),
            url: route.url.trim(),
            embedCode: route.embedCode.trim(),
          }))
          .filter((route) => route.title && (route.url || route.embedCode)),
      },
    })

    setValues(createEmptyValues())
    setCurrentStep(0)
    setStepError('')
    setUploadError('')
    setZipLookupError('')
    setNewCategoryName('')
    setNumericDrafts({})
    setQuestionOptionsDrafts({})
    setCollapsedCategories({})
  }

  return (
    <form className="panel event-form" onSubmit={handleSubmit}>
      <div className="event-form__header">
        <div className="section-heading">
          <h2>Cadastrar evento</h2>
          <p>Monte o evento por etapas, com capa, conteúdo da página, categorias, modalidades e revisão final antes de publicar a base.</p>
        </div>

        <div className="event-form__steps" aria-label="Etapas do cadastro do evento">
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              className={`event-form__step${index === currentStep ? ' event-form__step--active' : ''}`}
              onClick={() => setCurrentStep(index)}
            >
              <strong>{index + 1}</strong>
              <div>
                <span>{step.label}</span>
                <small>{step.description}</small>
              </div>
            </button>
          ))}
        </div>
      </div>

      {stepError ? <div className="error-inline">{stepError}</div> : null}

      {currentStep === 0 ? (
        <div className="event-form__panel form-grid">
          <label>
            <span>Título</span>
            <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required />
          </label>
          <label>
            <span>Categoria</span>
            <select value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value as EventFormValues['category'] })}>
              <option value="running">Corrida</option>
              <option value="triathlon">Triathlon</option>
              <option value="fight">Lutas</option>
              <option value="cycling">Ciclismo</option>
              <option value="fitness">Fitness</option>
              <option value="other">Outros</option>
            </select>
          </label>
          <label className="field-span-2">
            <span>Resumo curto</span>
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} rows={4} required />
          </label>
          <label>
            <span>Status inicial</span>
            <select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value as EventFormValues['status'] })}>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="closed">Encerrado</option>
            </select>
          </label>
          <label>
            <span>Início</span>
            <input type="datetime-local" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} required />
          </label>
          <label>
            <span>Fim</span>
            <input type="datetime-local" value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} required />
          </label>

          <section className="field-span-2 event-location-card">
            <div className="event-location-card__header">
              <h3>Local do evento</h3>
            </div>

            <div className="event-location-grid">
              <label className="event-location-grid__venue">
                <span>Local</span>
                <input value={values.venue} onChange={(event) => setValues({ ...values, venue: event.target.value })} placeholder="Ponto de referência" required />
              </label>
              <label className="event-location-grid__zip">
                <span>CEP</span>
                <div className="input-with-action">
                  <input value={values.zipCode} onChange={(event) => setValues({ ...values, zipCode: formatZipCode(event.target.value) })} placeholder="00000-000" inputMode="numeric" required />
                  <button type="button" className="input-with-action__button" onClick={() => void handleZipLookup()} disabled={isLookingUpZip}>
                    {isLookingUpZip ? '...' : 'Buscar'}
                  </button>
                </div>
              </label>
              <label className="event-location-grid__map">
                <span>Url Mapa</span>
                <div className="input-with-action">
                  <input value={values.mapUrl} onChange={(event) => setValues({ ...values, mapUrl: event.target.value })} placeholder="https://maps.google.com/..." />
                  <a
                    className={`input-with-action__button${values.mapUrl ? '' : ' input-with-action__button--disabled'}`}
                    href={values.mapUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!values.mapUrl}
                    onClick={(event) => {
                      if (!values.mapUrl) {
                        event.preventDefault()
                      }
                    }}
                  >
                    Mapa
                  </a>
                </div>
              </label>
              <label className="event-location-grid__address">
                <span>Logradouro</span>
                <input value={values.addressLine} onChange={(event) => setValues({ ...values, addressLine: event.target.value })} placeholder="Rua, avenida, parque, arena..." required />
              </label>
              <label className="event-location-grid__number">
                <span>Número</span>
                <input value={values.addressNumber} onChange={(event) => setValues({ ...values, addressNumber: event.target.value })} placeholder="88" required />
              </label>
              <label>
                <span>País</span>
                <select value={values.country} onChange={(event) => setValues({ ...values, country: event.target.value })}>
                  <option value="Brasil">Brasil</option>
                </select>
              </label>
              <label>
                <span>UF</span>
                <select value={values.state} onChange={(event) => setValues({ ...values, state: event.target.value.toUpperCase() })} required>
                  <option value="">Selecione</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cidade</span>
                <input value={values.city} onChange={(event) => setValues({ ...values, city: event.target.value })} placeholder="São Paulo" required />
              </label>
            </div>

            {zipLookupError ? <div className="error-inline">{zipLookupError}</div> : null}
          </section>

          <div className="field-span-2 event-cover-upload">
            <div className="event-cover-upload__content">
              <div>
                <strong>Capa do evento</strong>
                <p>Envie a imagem para o bucket da AWS via URL pré-assinada. Enquanto o bucket não existir, você ainda pode informar uma URL manual.</p>
              </div>
              <div>
                <small>Localização</small>
                <p>{values.venue && values.city && values.state ? `${values.venue} • ${values.city}/${values.state}` : 'Não informado'}</p>
              </div>
              <label className="event-cover-upload__dropzone">
                <span>Selecionar imagem</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handleCoverUpload(file)
                    }
                  }}
                />
                <small>{isUploadingCover ? 'Enviando para AWS...' : 'PNG, JPG ou WEBP'}</small>
              </label>
              <label>
                <span>URL manual da capa</span>
                <input value={values.coverImage} onChange={(event) => setValues({ ...values, coverImage: event.target.value })} placeholder="https://..." />
              </label>
              {uploadError ? <div className="error-inline">{uploadError}</div> : null}
            </div>
            <div className="event-cover-upload__preview">
              {coverPreview ? <img src={coverPreview} alt="Pré-visualização da capa do evento" /> : <span>Pré-visualização da capa</span>}
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="event-form__panel form-grid">
          <label className="field-span-2">
            <span>Sobre o evento</span>
            <textarea rows={6} value={values.pageSections.aboutEvent} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, aboutEvent: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Percursos</span>
            <textarea rows={5} value={values.pageSections.routes} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, routes: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Inscrições</span>
            <textarea rows={5} value={values.pageSections.registrations} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, registrations: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Entrega de kits</span>
            <textarea rows={5} value={values.pageSections.kitDelivery} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, kitDelivery: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Premiação</span>
            <textarea rows={4} value={values.pageSections.awards} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, awards: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Programação</span>
            <textarea rows={4} value={values.pageSections.schedule} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, schedule: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Regulamento</span>
            <textarea rows={4} value={values.pageSections.regulation} onChange={(event) => setValues({ ...values, pageSections: { ...values.pageSections, regulation: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Link do regulamento</span>
            <input value={values.operationalDetails.regulationUrl} onChange={(event) => setValues({ ...values, operationalDetails: { ...values.operationalDetails, regulationUrl: event.target.value } })} placeholder="https://..." />
          </label>
          <div className="field-span-2 event-form__group">
            <div className="subpanel__header">
              <div>
                <h4>Percursos no Strava</h4>
                <p>Cadastre quantos percursos quiser com nome e link próprios.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setValues((current) => ({
                  ...current,
                  pageSections: {
                    ...current.pageSections,
                    stravaRoutes: [...current.pageSections.stravaRoutes, emptyStravaRoute(`Percurso ${current.pageSections.stravaRoutes.length + 1}`)],
                  },
                }))}
              >
                Adicionar percurso
              </button>
            </div>

            {values.pageSections.stravaRoutes.map((route, routeIndex) => (
              <div key={`strava-route-${routeIndex}`} className="subpanel subpanel--soft">
                <div className="subpanel__header">
                  <h4>{route.title || `Percurso ${routeIndex + 1}`}</h4>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setValues((current) => ({
                      ...current,
                      pageSections: {
                        ...current.pageSections,
                        stravaRoutes: current.pageSections.stravaRoutes.filter((_, currentRouteIndex) => currentRouteIndex !== routeIndex),
                      },
                    }))}
                  >
                    Remover percurso
                  </button>
                </div>

                <div className="nested-grid">
                  <label>
                    <span>Título do percurso</span>
                    <input
                      value={route.title}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        pageSections: {
                          ...current.pageSections,
                          stravaRoutes: current.pageSections.stravaRoutes.map((currentRoute, currentRouteIndex) => currentRouteIndex === routeIndex ? { ...currentRoute, title: event.target.value } : currentRoute),
                        },
                      }))}
                      placeholder="Percurso 5km"
                    />
                  </label>
                  <label>
                    <span>Link do percurso</span>
                    <input
                      value={route.url}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        pageSections: {
                          ...current.pageSections,
                          stravaRoutes: current.pageSections.stravaRoutes.map((currentRoute, currentRouteIndex) => currentRouteIndex === routeIndex ? { ...currentRoute, url: event.target.value } : currentRoute),
                        },
                      }))}
                      placeholder="https://www.strava.com/routes/..."
                    />
                  </label>
                  <label className="field-span-2">
                    <span>Código de embed do percurso (opcional)</span>
                    <textarea
                      value={route.embedCode}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        pageSections: {
                          ...current.pageSections,
                          stravaRoutes: current.pageSections.stravaRoutes.map((currentRoute, currentRouteIndex) => currentRouteIndex === routeIndex ? { ...currentRoute, embedCode: event.target.value } : currentRoute),
                        },
                      }))}
                      placeholder="Cole aqui o snippet do Strava para este percurso"
                      rows={5}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="event-form__panel form-grid">
          {canAssignManager ? (
            <label>
              <span>Admin do evento</span>
              <select value={values.managedBy} onChange={(event) => setValues({ ...values, managedBy: event.target.value })}>
                <option value="">Selecionar depois</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Organizador</span>
            <input value={values.organizer.name} onChange={(event) => setValues({ ...values, organizer: { ...values.organizer, name: event.target.value } })} required />
          </label>
          <label>
            <span>E-mail do organizador</span>
            <input type="email" value={values.organizer.contactEmail} onChange={(event) => setValues({ ...values, organizer: { ...values.organizer, contactEmail: event.target.value } })} required />
          </label>
          <label>
            <span>Telefone do organizador</span>
            <input value={values.organizer.contactPhone} onChange={(event) => setValues({ ...values, organizer: { ...values.organizer, contactPhone: event.target.value } })} />
          </label>
          <label className="field-span-2">
            <span>Destaques</span>
            <input value={values.highlights.join(', ')} onChange={(event) => setValues({ ...values, highlights: event.target.value.split(',').map((item) => item.trim()) })} placeholder="Kit premium, cronometragem ao vivo, experiência VIP" />
          </label>
          <div className="field-span-2 event-form__hint panel panel--plain">
            <strong>Taxa comercial do organizador</strong>
            <p>A taxa de serviço do checkout é definida no cadastro do organizador pelo super admin e aplicada automaticamente em todas as modalidades desse evento.</p>
          </div>

          <div className="field-span-2 event-form__group">
            <div className="subpanel subpanel--soft event-policy-settings-card">
              <div className="subpanel__header">
                <div>
                  <h4>Política automática de cancelamento</h4>
                  <p>Essas regras passam a valer para o checkout, suporte e cálculo de estorno deste evento.</p>
                </div>
              </div>

              <div className="nested-grid">
                <label>
                  <span>Estorno integral até</span>
                  <input
                    type="number"
                    min="0"
                    value={values.operationalDetails.cancellationPolicySettings.fullRefundHoursBeforeEvent}
                    onChange={(event) => setValues({
                      ...values,
                      operationalDetails: {
                        ...values.operationalDetails,
                        cancellationPolicySettings: {
                          ...values.operationalDetails.cancellationPolicySettings,
                          fullRefundHoursBeforeEvent: Number(event.target.value) || 0,
                        },
                      },
                    })}
                  />
                </label>

                <label>
                  <span>Estorno parcial até</span>
                  <input
                    type="number"
                    min="0"
                    max={values.operationalDetails.cancellationPolicySettings.fullRefundHoursBeforeEvent}
                    value={values.operationalDetails.cancellationPolicySettings.partialRefundHoursBeforeEvent}
                    onChange={(event) => setValues({
                      ...values,
                      operationalDetails: {
                        ...values.operationalDetails,
                        cancellationPolicySettings: {
                          ...values.operationalDetails.cancellationPolicySettings,
                          partialRefundHoursBeforeEvent: Number(event.target.value) || 0,
                        },
                      },
                    })}
                  />
                </label>

                <label>
                  <span>Percentual do estorno parcial</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={values.operationalDetails.cancellationPolicySettings.partialRefundPercent}
                    onChange={(event) => setValues({
                      ...values,
                      operationalDetails: {
                        ...values.operationalDetails,
                        cancellationPolicySettings: {
                          ...values.operationalDetails.cancellationPolicySettings,
                          partialRefundPercent: Number(event.target.value) || 0,
                        },
                      },
                    })}
                  />
                </label>

                <label className="field-span-2">
                  <span>Observações adicionais da política</span>
                  <textarea
                    rows={3}
                    value={values.operationalDetails.cancellationPolicy}
                    onChange={(event) => setValues({
                      ...values,
                      operationalDetails: {
                        ...values.operationalDetails,
                        cancellationPolicy: event.target.value,
                      },
                    })}
                    placeholder="Ex.: transferências seguem análise manual da organização."
                  />
                </label>
              </div>

              <div className="panel panel--plain event-policy-settings-preview">
                <strong>Resumo gerado</strong>
                <p>{cancellationPolicyPreview}</p>
                {values.operationalDetails.cancellationPolicy ? <small>{values.operationalDetails.cancellationPolicy}</small> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="event-form__panel event-form__tickets">
          {ticketGroups.map((group, groupIndex) => (
            <div key={group.groupId} className="subpanel field-span-2">
              <div className="event-form__category-header">
                <div className="event-form__category-heading">
                  <div>
                    <h3>{group.groupName || `Categoria ${groupIndex + 1}`}</h3>
                    <p>{group.ticketIndexes.length} modalidade(s) nessa categoria</p>
                  </div>
                </div>
                <div className="event-form__category-actions">
                  <button type="button" className="ghost-button" onClick={() => toggleCategory(group.groupId)}>
                    {isCategoryCollapsed(group.groupId) ? 'Expandir categoria' : 'Minimizar categoria'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => addModalityToGroup(group.groupId, group.groupName)}>
                    Adicionar modalidade
                  </button>
                  <button type="button" className="ghost-button" onClick={() => removeCategoryGroup(group.groupId)} disabled={ticketGroups.length === 1}>
                    Remover categoria
                  </button>
                </div>
              </div>

              <div className="nested-grid">
                <label className="field-span-2">
                  <span>Nome da categoria</span>
                  <input value={group.groupName} onChange={(event) => updateCategoryGroupName(group.groupId, event.target.value)} placeholder="Kit básico, Kit premium..." required />
                </label>
              </div>

              {!isCategoryCollapsed(group.groupId) ? (
                <div className="event-form__group">
                  {group.ticketIndexes.map((ticketIndex, modalityIndex) => {
                    const ticket = values.ticketTypes[ticketIndex]

                    return (
                      <div key={`ticket-${ticket.groupId}-${ticketIndex}`} className="subpanel subpanel--soft">
                        <div className="subpanel__header">
                          <div>
                            <h4>{ticket.name || `Modalidade ${modalityIndex + 1}`}</h4>
                            <p>{ticket.batches.length} lote(s) • {ticket.additionalQuestions.length} pergunta(s)</p>
                          </div>
                          <button type="button" className="ghost-button" onClick={() => setValues((current) => ({ ...current, ticketTypes: current.ticketTypes.filter((_, currentIndex) => currentIndex !== ticketIndex) }))} disabled={values.ticketTypes.length === 1}>
                            Remover modalidade
                          </button>
                        </div>

                        <div className="nested-grid">
                          <label>
                            <span>Nome da modalidade</span>
                            <input value={ticket.name} onChange={(event) => updateTicketField(ticketIndex, 'name', event.target.value)} placeholder="5km, 10km, 21km..." required />
                          </label>
                          <label>
                            <span>Capacidade da modalidade</span>
                            <input inputMode="numeric" value={getNumericInputValue(`ticket-${ticketIndex}-quantity`, ticket.quantity)} onChange={(event) => handleNumericInputChange(`ticket-${ticketIndex}-quantity`, (value) => updateTicketField(ticketIndex, 'quantity', value), event.target.value)} onBlur={() => handleNumericInputBlur(`ticket-${ticketIndex}-quantity`, 1, (value) => updateTicketField(ticketIndex, 'quantity', Math.max(1, Math.round(value))))} required />
                          </label>
                          <label className="field-span-2">
                            <span>Descrição da modalidade</span>
                            <textarea value={ticket.description} rows={2} onChange={(event) => updateTicketField(ticketIndex, 'description', event.target.value)} />
                          </label>
                        </div>

                        <div className="event-form__group">
                          <div className="subpanel__header">
                            <h4>Perguntas adicionais da modalidade</h4>
                            <button type="button" className="ghost-button" onClick={() => setValues((current) => ({ ...current, ticketTypes: current.ticketTypes.map((currentTicket, currentIndex) => currentIndex === ticketIndex ? { ...currentTicket, additionalQuestions: [...currentTicket.additionalQuestions, emptyAdditionalQuestion()] } : currentTicket) }))}>
                              Adicionar pergunta
                            </button>
                          </div>

                          {ticket.additionalQuestions.length ? ticket.additionalQuestions.map((question, questionIndex) => (
                            <div key={`ticket-${ticketIndex}-question-${questionIndex}`} className="subpanel subpanel--soft">
                              <div className="subpanel__header">
                                <h4>Pergunta {questionIndex + 1}</h4>
                                <button type="button" className="ghost-button" onClick={() => setValues((current) => ({ ...current, ticketTypes: current.ticketTypes.map((currentTicket, currentIndex) => currentIndex === ticketIndex ? { ...currentTicket, additionalQuestions: currentTicket.additionalQuestions.filter((_, currentQuestionIndex) => currentQuestionIndex !== questionIndex) } : currentTicket) }))}>
                                  Remover pergunta
                                </button>
                              </div>
                              <div className="nested-grid">
                                <label>
                                  <span>Pergunta</span>
                                  <input value={question.label} onChange={(event) => updateAdditionalQuestionField(ticketIndex, questionIndex, 'label', event.target.value)} />
                                </label>
                                <label>
                                  <span>Tipo</span>
                                  <select value={question.type} onChange={(event) => updateAdditionalQuestionField(ticketIndex, questionIndex, 'type', event.target.value as EventAdditionalQuestion['type'])}>
                                    <option value="text">Texto curto</option>
                                    <option value="number">Número</option>
                                    <option value="select">Seleção única</option>
                                    <option value="checkbox">Múltipla escolha</option>
                                  </select>
                                </label>
                                <label>
                                  <span>Placeholder</span>
                                  <input value={question.placeholder} onChange={(event) => updateAdditionalQuestionField(ticketIndex, questionIndex, 'placeholder', event.target.value)} />
                                </label>
                                <label>
                                  <span>Obrigatória</span>
                                  <select value={question.required ? 'yes' : 'no'} onChange={(event) => updateAdditionalQuestionField(ticketIndex, questionIndex, 'required', event.target.value === 'yes')}>
                                    <option value="yes">Sim</option>
                                    <option value="no">Não</option>
                                  </select>
                                </label>
                                <label className="field-span-2">
                                  <span>Ajuda para o atleta</span>
                                  <input value={question.helperText} onChange={(event) => updateAdditionalQuestionField(ticketIndex, questionIndex, 'helperText', event.target.value)} />
                                </label>
                                {question.type === 'select' || question.type === 'checkbox' ? (
                                  <label className="field-span-2">
                                    <span>Opções</span>
                                    <input value={getQuestionOptionsInputValue(ticketIndex, questionIndex, question.options)} onChange={(event) => handleQuestionOptionsChange(ticketIndex, questionIndex, event.target.value)} placeholder="P, M, G, GG ou Masculino, Feminino" />
                                  </label>
                                ) : null}
                              </div>
                            </div>
                          )) : <div className="subpanel subpanel--soft event-form__hint"><p>Sem perguntas extras para essa modalidade.</p></div>}
                        </div>

                        {ticket.batches.map((batch, batchIndex) => (
                          <div key={`ticket-${ticketIndex}-batch-${batchIndex}`} className="subpanel subpanel--soft">
                            <div className="subpanel__header">
                              <h4>Lote {batchIndex + 1}</h4>
                              <button type="button" className="ghost-button" onClick={() => setValues((current) => ({ ...current, ticketTypes: current.ticketTypes.map((currentTicket, currentIndex) => currentIndex === ticketIndex ? { ...currentTicket, batches: currentTicket.batches.filter((_, currentBatchIndex) => currentBatchIndex !== batchIndex) } : currentTicket) }))} disabled={ticket.batches.length === 1}>
                                Remover lote
                              </button>
                            </div>
                            <div className="nested-grid">
                              <label>
                                <span>Nome do lote</span>
                                <input value={batch.name} onChange={(event) => updateBatchField(ticketIndex, batchIndex, 'name', event.target.value)} required />
                              </label>
                              <label>
                                <span>Status</span>
                                <select value={batch.status} onChange={(event) => updateBatchField(ticketIndex, batchIndex, 'status', event.target.value)}>
                                  <option value="scheduled">Agendado</option>
                                  <option value="active">Ativo</option>
                                  <option value="closed">Encerrado</option>
                                </select>
                              </label>
                              <label>
                                <span>Início do lote</span>
                                <input type="datetime-local" value={batch.startAt} onChange={(event) => updateBatchField(ticketIndex, batchIndex, 'startAt', event.target.value)} required />
                              </label>
                              <label>
                                <span>Fim do lote</span>
                                <input type="datetime-local" value={batch.endAt} onChange={(event) => updateBatchField(ticketIndex, batchIndex, 'endAt', event.target.value)} required />
                              </label>
                              <label>
                                <span>Preço do lote</span>
                                <input inputMode="decimal" value={getNumericInputValue(`ticket-${ticketIndex}-batch-${batchIndex}-price`, batch.price)} onChange={(event) => handleNumericInputChange(`ticket-${ticketIndex}-batch-${batchIndex}-price`, (value) => updateBatchField(ticketIndex, batchIndex, 'price', value), event.target.value)} onBlur={() => handleNumericInputBlur(`ticket-${ticketIndex}-batch-${batchIndex}-price`, 0, (value) => updateBatchField(ticketIndex, batchIndex, 'price', Math.max(0, value)))} required />
                              </label>
                              <label>
                                <span>Quantidade do lote</span>
                                <input inputMode="numeric" value={getNumericInputValue(`ticket-${ticketIndex}-batch-${batchIndex}-quantity`, batch.quantity)} onChange={(event) => handleNumericInputChange(`ticket-${ticketIndex}-batch-${batchIndex}-quantity`, (value) => updateBatchField(ticketIndex, batchIndex, 'quantity', value), event.target.value)} onBlur={() => handleNumericInputBlur(`ticket-${ticketIndex}-batch-${batchIndex}-quantity`, 1, (value) => updateBatchField(ticketIndex, batchIndex, 'quantity', Math.max(1, Math.round(value))))} required />
                              </label>
                            </div>
                          </div>
                        ))}

                        <button type="button" className="ghost-button" onClick={() => setValues((current) => ({ ...current, ticketTypes: current.ticketTypes.map((currentTicket, currentIndex) => currentIndex === ticketIndex ? { ...currentTicket, batches: [...currentTicket.batches, { ...emptyBatch(), name: `Lote ${currentTicket.batches.length + 1}`, price: resolveCategoryPrice(currentTicket) }] } : currentTicket) }))}>
                          Adicionar lote
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ))}

          <div className="actions-row event-form__new-category-row">
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nome da nova categoria, ex.: Categoria premium" />
            <button type="button" className="ghost-button" onClick={addCategoryGroup}>
              Adicionar nova categoria
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="event-form__panel event-form__review">
          <div className="event-form__review-card">
            <strong>Resumo do evento</strong>
            <div className="event-form__review-grid">
              <div><small>Título</small><p>{values.title || 'Não informado'}</p></div>
              <div><small>Categoria</small><p>{values.category}</p></div>
              <div><small>Local</small><p>{values.city && values.state ? `${values.city}/${values.state}` : 'Não informado'}</p></div>
              <div><small>Período</small><p>{values.startDate && values.endDate ? 'Datas definidas' : 'Pendente'}</p></div>
              <div><small>Organizador</small><p>{values.organizer.name || 'Não informado'}</p></div>
              <div><small>Seções da página</small><p>{[
                values.pageSections.aboutEvent,
                values.pageSections.routes,
                values.pageSections.registrations,
                values.pageSections.kitDelivery,
                values.pageSections.awards,
                values.pageSections.schedule,
                values.pageSections.regulation,
              ].filter(Boolean).length + (values.pageSections.stravaRoutes.some((route) => route.title.trim() && (route.url.trim() || route.embedCode.trim())) ? 1 : 0)}</p></div>
              <div><small>Regulamento</small><p>{values.operationalDetails.regulationUrl ? 'Configurado' : 'Pendente'}</p></div>
              <div><small>Política automática</small><p>{cancellationPolicyPreview}</p></div>
              <div><small>Categorias</small><p>{ticketGroups.length} categoria(s)</p></div>
              <div><small>Modalidades</small><p>{values.ticketTypes.length} modalidade(s)</p></div>
              <div><small>Perguntas adicionais</small><p>{values.ticketTypes.reduce((total, ticket) => total + ticket.additionalQuestions.length, 0)}</p></div>
            </div>
          </div>

          <div className="event-form__review-card">
            <strong>Conferência comercial</strong>
            <ul className="plain-list">
              <li>Capa pronta: {values.coverImage ? 'sim' : 'não'}</li>
              <li>Destaques preenchidos: {values.highlights.filter(Boolean).length}</li>
              <li>Link do regulamento: {values.operationalDetails.regulationUrl ? 'sim' : 'não'}</li>
              <li>Janela de estorno integral: {formatHoursAsWindow(values.operationalDetails.cancellationPolicySettings.fullRefundHoursBeforeEvent)}</li>
              <li>Janela de estorno parcial: {formatHoursAsWindow(values.operationalDetails.cancellationPolicySettings.partialRefundHoursBeforeEvent)} ({values.operationalDetails.cancellationPolicySettings.partialRefundPercent}%)</li>
              <li>Lotes configurados: {values.ticketTypes.reduce((total, ticket) => total + ticket.batches.length, 0)}</li>
              <li>Status inicial: {values.status}</li>
            </ul>
          </div>
        </div>
      ) : null}

      <div className="event-form__footer">
        <button type="button" className="ghost-button" onClick={goToPreviousStep} disabled={currentStep === 0}>Voltar</button>
        <div className="event-form__footer-actions">
          {currentStep < steps.length - 1 ? (
            <button type="button" className="primary-button" onClick={goToNextStep}>Continuar</button>
          ) : (
            <button type="submit" className="primary-button" disabled={isSubmitting || isUploadingCover}>{isSubmitting ? 'Salvando...' : 'Salvar evento'}</button>
          )}
        </div>
      </div>
    </form>
  )
}