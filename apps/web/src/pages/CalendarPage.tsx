import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../lib/api'
import { categoryLabel, formatDate } from '../lib/format'
import type { EventItem } from '../types'

export function CalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.getEvents()
      .then(({ events: incomingEvents }) => setEvents(incomingEvents))
      .catch((err: Error) => setError(err.message))
  }, [])

  const groupedEvents = useMemo(() => {
    return events.reduce<Record<string, EventItem[]>>((accumulator, event) => {
      const label = new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(event.startDate))

      accumulator[label] = [...(accumulator[label] || []), event]
      return accumulator
    }, {})
  }, [events])

  return (
    <div className="page-shell">
      <section className="content-section compact-top section-surface">
        <div className="section-heading">
          <span className="eyebrow">Agenda</span>
          <h1>Calendário de eventos</h1>
        </div>

        {error ? <div className="panel error-panel">{error}</div> : null}

        <div className="calendar-list">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <section key={month} className="calendar-group">
              <header className="calendar-group__header">
                <h2>{month}</h2>
                <span>{monthEvents.length} eventos</span>
              </header>

              <div className="calendar-group__items">
                {monthEvents.map((event) => (
                  <article key={event._id} className="calendar-row">
                    <div className="calendar-row__date">
                      <strong>
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(new Date(event.startDate))}
                      </strong>
                      <span>
                        {new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(event.startDate))}
                      </span>
                    </div>
                    <div className="calendar-row__content">
                      <small>{categoryLabel(event.category)}</small>
                      <h3>{event.title}</h3>
                      <p>{event.city}/{event.state} • {event.venue}</p>
                    </div>
                    <div className="calendar-row__meta">
                      <span>{formatDate(event.startDate)}</span>
                      {event.status === 'closed' ? <span className="status-badge status-closed">Inscrições encerradas</span> : null}
                      <Link to={`/e/${event.slug}`} className="ghost-button">
                        Ver evento
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}