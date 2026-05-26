import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EventCard } from '../components/EventCard'
import { api } from '../lib/api'
import type { EventItem } from '../types'

export function EventsPage() {
  const [searchParams] = useSearchParams()
  const [city, setCity] = useState(searchParams.get('city') || '')
  const [category, setCategory] = useState('')
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.getEvents({ city, category })
      .then(({ events: incomingEvents }) => {
        setEvents(incomingEvents)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
  }, [category, city])

  return (
    <div className="page-shell">
      <section className="content-section compact-top section-surface">
        <div className="section-heading inline-heading">
          <div>
            <span className="eyebrow">Catálogo</span>
            <h1>Eventos disponíveis</h1>
            <p>Filtre por local do evento e categoria para acelerar descoberta e conversão.</p>
          </div>
        </div>

        <div className="filters-panel">
          <label>
            <span>Cidade</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: São Paulo" />
          </label>
          <label>
            <span>Categoria</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas</option>
              <option value="running">Corrida</option>
              <option value="triathlon">Triathlon</option>
              <option value="fight">Lutas</option>
              <option value="cycling">Ciclismo</option>
              <option value="fitness">Fitness</option>
              <option value="other">Outros</option>
            </select>
          </label>
        </div>

        {error ? <div className="panel error-panel">{error}</div> : null}

        <div className="cards-grid">
          {events.map((event) => (
            <EventCard key={event._id} event={event} />
          ))}
        </div>
      </section>
    </div>
  )
}