import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import type { EventItem } from '../types'

function totalCapacityByEvent(event: EventItem) {
  return event.ticketTypes.reduce((total, ticket) => total + ticket.quantity, 0)
}

function getStatusLabel(status: EventItem['status']) {
  if (status === 'published') {
    return 'publicado'
  }

  if (status === 'draft') {
    return 'rascunho'
  }

  return 'inscrições encerradas'
}

export function EventsManagementPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')
  const [updatingEventId, setUpdatingEventId] = useState('')

  useEffect(() => {
    if (!token) return

    api.getManagedEvents(token)
      .then((response) => setEvents(response.events))
      .catch((err: Error) => {
        setError(err.message)
        toast.error(err.message)
      })
  }, [token, toast])

  const publishedCount = useMemo(() => events.filter((event) => event.status === 'published').length, [events])

  async function handleUpdateStatus(event: EventItem, status: EventItem['status']) {
    if (!token) {
      return
    }

    setUpdatingEventId(event._id)
    setError('')

    try {
      const response = await api.updateEventStatus(token, event._id, status)

      setEvents((current) => current.map((currentEvent) => (currentEvent._id === event._id ? response.event : currentEvent)))

      const actionLabel = status === 'published'
        ? 'com inscrições liberadas novamente'
        : status === 'draft'
          ? 'movido para rascunho'
          : 'com inscrições encerradas'

      toast.success(`Evento ${actionLabel} com sucesso.`)
    } catch (currentError) {
      const message = (currentError as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setUpdatingEventId('')
    }
  }

  return (
    <section className="content-section compact-top">
      <div className="section-heading inline-heading">
        <div>
          <span className="eyebrow">Eventos</span>
          <h1>Eventos cadastrados</h1>
          <p>Visualização dedicada dos eventos criados na base, sem competir com cadastro de organizador e indicadores do painel.</p>
        </div>
        <Link to="/gestao-eventos" className="primary-button">Cadastrar novo evento</Link>
      </div>

      {error ? <div className="panel error-panel">{error}</div> : null}

      <div className="compact-grid">
        <article className="stat-card">
          <span>Total de eventos</span>
          <strong>{events.length}</strong>
          <small>Todos os eventos registrados na base</small>
        </article>
        <article className="stat-card">
          <span>Publicados</span>
          <strong>{publishedCount}</strong>
          <small>Prontos para venda e visiveis ao publico</small>
        </article>
      </div>

      <div className="list-stack">
        {events.map((event) => (
          <article key={event._id} className="panel module-list-card">
            <div className="module-list-card__header list-row">
              <div>
                <strong>{event.title}</strong>
                <small>{event.city}/{event.state} • {formatDate(event.startDate)}</small>
              </div>
              <span className={`status-badge status-${event.status}`}>{getStatusLabel(event.status)}</span>
            </div>

            <div className="module-list-card__grid">
              <div>
                <small>Organizador</small>
                <p>{event.organizer.name}</p>
              </div>
              <div>
                <small>Modalidades</small>
                <p>{event.ticketTypes.length}</p>
              </div>
              <div>
                <small>Capacidade</small>
                <p>{totalCapacityByEvent(event)} vagas</p>
              </div>
            </div>

            <div className="module-list-card__actions">
              <Link className="ghost-button" to={`/gestao-eventos/${event._id}/editar`}>
                Editar evento
              </Link>

              {event.status !== 'draft' ? (
                <button type="button" className="ghost-button" onClick={() => void handleUpdateStatus(event, 'draft')} disabled={updatingEventId === event._id}>
                  Despublicar
                </button>
              ) : null}

              {event.status === 'published' ? (
                <button type="button" className="ghost-button" onClick={() => void handleUpdateStatus(event, 'closed')} disabled={updatingEventId === event._id}>
                  {updatingEventId === event._id ? 'Atualizando...' : 'Encerrar inscrições'}
                </button>
              ) : null}

              {event.status === 'closed' ? (
                <button type="button" className="primary-button" onClick={() => void handleUpdateStatus(event, 'published')} disabled={updatingEventId === event._id}>
                  {updatingEventId === event._id ? 'Atualizando...' : 'Retomar inscrições'}
                </button>
              ) : null}

              {event.status === 'draft' ? (
                <button type="button" className="primary-button" onClick={() => void handleUpdateStatus(event, 'published')} disabled={updatingEventId === event._id}>
                  {updatingEventId === event._id ? 'Atualizando...' : 'Publicar inscrições'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}