import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EventForm } from '../components/EventForm'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import type { EventFormValues, EventItem, User } from '../types'

export function EventAdminPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const toast = useToast()
  const [managers, setManagers] = useState<User[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)

  function formatDateTimeLocal(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const pad = (segment: number) => String(segment).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function mapEventToFormValues(event: EventItem): EventFormValues {
    return {
      title: event.title,
      category: event.category,
      description: event.description,
      contentHtml: event.contentHtml,
      zipCode: event.zipCode,
      city: event.city,
      state: event.state,
      country: event.country,
      venue: event.venue,
      addressLine: event.addressLine,
      addressNumber: event.addressNumber,
      mapUrl: event.mapUrl,
      coverImage: event.coverImage,
      startDate: formatDateTimeLocal(event.startDate),
      endDate: formatDateTimeLocal(event.endDate),
      status: event.status,
      organizer: {
        name: event.organizer.name,
        contactEmail: event.organizer.contactEmail,
        contactPhone: event.organizer.contactPhone,
      },
      pageSections: {
        ...event.pageSections,
        stravaRoutes: event.pageSections.stravaRoutes || [],
      },
      operationalDetails: event.operationalDetails,
      managedBy: typeof event.managedBy === 'string'
        ? event.managedBy
        : event.managedBy?._id || event.managedBy?.id || '',
      highlights: event.highlights.length ? event.highlights : [''],
      ticketTypes: event.ticketTypes,
    }
  }

  async function loadData() {
    if (!token) return

    const eventsResponse = await api.getManagedEvents(token)
    setEvents(eventsResponse.events)

    if (user?.role === 'super_admin') {
      const managersResponse = await api.listUsers(token, 'event_admin')
      setManagers(managersResponse.users)
    }
  }

  useEffect(() => {
    loadData().catch((err: Error) => {
      setError(err.message)
      toast.error(err.message)
    })
  }, [token, user?.role, toast])

  useEffect(() => {
    if (!eventId) {
      setEditingEvent(null)
      return
    }

    setIsLoadingEvent(true)
    setError('')

    api.getEventById(eventId)
      .then((response) => {
        setEditingEvent(response.event)
      })
      .catch((err: Error) => {
        setError(err.message)
        toast.error(err.message)
      })
      .finally(() => {
        setIsLoadingEvent(false)
      })
  }, [eventId, toast])

  async function handleSubmit(values: EventFormValues) {
    if (!token) return
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      if (eventId) {
        await api.updateEvent(token, eventId, values)
        setSuccess('Evento atualizado com sucesso.')
        toast.success('Evento atualizado com sucesso.')
        await loadData()
        navigate('/eventos-cadastrados')
        return
      }

      await api.createEvent(token, values)
      setSuccess('Evento cadastrado com sucesso.')
      toast.success('Evento cadastrado com sucesso.')
      await loadData()
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="content-section compact-top">
      <div className="section-heading inline-heading">
        <div>
          <span className="eyebrow">Gestão</span>
          <h1>{eventId ? 'Editar evento' : 'Cadastro de evento'}</h1>
          <p>{eventId ? 'Atualize os dados operacionais e comerciais do evento já cadastrado.' : 'Estruture o evento, configure categorias, modalidades, perguntas adicionais e lotes em um único fluxo.'}</p>
        </div>
        {eventId ? <Link to="/eventos-cadastrados" className="ghost-button">Voltar para eventos cadastrados</Link> : null}
      </div>

      {error ? <div className="panel error-panel">{error}</div> : null}
      {success ? <div className="panel success-panel">{success}</div> : null}

      {isLoadingEvent ? <div className="panel panel--plain">Carregando dados do evento...</div> : null}

      {!isLoadingEvent ? (
        <EventForm
          onSubmit={handleSubmit}
          managers={managers}
          isSubmitting={isSubmitting}
          canAssignManager={user?.role === 'super_admin'}
          initialValues={editingEvent ? mapEventToFormValues(editingEvent) : null}
        />
      ) : null}
    </section>
  )
}