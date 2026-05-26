import { Link } from 'react-router-dom'

import { formatCurrency, formatDate, categoryLabel } from '../lib/format'
import type { EventItem } from '../types'

function resolveCategoryPrice(event: EventItem) {
  const firstCategory = event.ticketTypes[0]

  if (!firstCategory) {
    return 0
  }

  const activeBatch = firstCategory.batches.find((batch) => batch.status === 'active')

  if (activeBatch) {
    return activeBatch.price
  }

  const scheduledBatch = [...firstCategory.batches]
    .filter((batch) => batch.status === 'scheduled')
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0]

  if (scheduledBatch) {
    return scheduledBatch.price
  }

  return firstCategory.batches.reduce((lowestPrice, batch) => Math.min(lowestPrice, batch.price), firstCategory.batches[0]?.price ?? 0)
}

export function EventCard({ event }: { event: EventItem }) {
  const categoryPrice = resolveCategoryPrice(event)
  const isClosed = event.status === 'closed'

  return (
    <Link to={`/e/${event.slug}`} className="event-card">
      <div className="event-card__media">
        <span className="event-card__category">{categoryLabel(event.category)}</span>
        <img src={event.coverImage} alt={event.title} />
      </div>
      <div className="event-card__body">
        <div className="event-card__meta">
          <span>{event.city}/{event.state}</span>
          {isClosed ? <span className="status-badge status-closed">Inscrições encerradas</span> : null}
        </div>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <div className="event-card__details">
          <strong>{formatDate(event.startDate)}</strong>
          <span>{event.venue}</span>
        </div>
        <div className="event-card__footer">
          <div>
            <small>{isClosed ? 'Status: ' : 'A partir de: '}</small>
            <strong>{isClosed ? 'Inscrições encerradas' : formatCurrency(categoryPrice)}</strong>
          </div>
        </div>
      </div>
    </Link>
  )
}