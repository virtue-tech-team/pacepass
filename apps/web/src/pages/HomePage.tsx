import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EventCard } from '../components/EventCard'
import { api } from '../lib/api'
import type { EventItem } from '../types'

export function HomePage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')
  const [searchCity, setSearchCity] = useState('')

  const featuredCity = useMemo(() => events[0]?.city || 'sua região', [events])

  useEffect(() => {
    api.getEvents()
      .then(({ events: incomingEvents }) => {
        setEvents(incomingEvents.slice(0, 6))
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const city = searchCity.trim()
    navigate(city ? `/eventos?city=${encodeURIComponent(city)}` : '/eventos')
  }

  return (
    <div className="page-shell">
      <section className="hero-banner">
        <div className="hero-banner__overlay">
          <span className="eyebrow eyebrow-light">Descubra seu próximo desafio</span>
          <h1>Desafie seus limites</h1>
          <p>Encontre um evento perto de você e movimente seu estilo de vida com corridas, triathlons e muito mais.</p>

          <form className="hero-search" onSubmit={handleSearchSubmit}>
            <label className="hero-search__region">
              <span>País</span>
              <select defaultValue="Brasil">
                <option>Brasil</option>
              </select>
            </label>

            <label className="hero-search__input">
              <span>Buscar evento</span>
              <input
                value={searchCity}
                onChange={(event) => setSearchCity(event.target.value)}
                placeholder="Pesquise por cidade, nome do evento ou estado"
              />
            </label>

            <button type="submit" className="primary-button">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="content-section section-surface">
        <div className="section-heading inline-heading">
          <div>
            <h2>Eventos perto de {featuredCity}</h2>
            <p>Descubra experiências esportivas próximas a você e encontre sua próxima inscrição.</p>
          </div>
          <Link className="text-link" to="/eventos">
            Mostrar todos
          </Link>
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