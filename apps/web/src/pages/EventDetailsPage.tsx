import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { categoryLabel, formatCurrency, formatDate } from '../lib/format'
import { parseStravaEmbedSnippet, parseStravaRouteUrl, type StravaEmbedConfig } from '../lib/strava'
import type { EventBatch, EventItem, TicketType } from '../types'

interface StravaRouteViewModel {
  title: string
  url: string
  embed: StravaEmbedConfig | null
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

  return [...ticket.batches].sort((left, right) => left.price - right.price)[0]
}

function resolveFirstBatch(event: EventItem) {
  const batches = event.ticketTypes
    .map(resolveDisplayBatch)
    .filter((batch): batch is EventBatch => Boolean(batch))

  return [...batches].sort((left, right) => left.price - right.price)[0]
}

function resolveRegistrationDeadline(event: EventItem) {
  const dates = event.ticketTypes.flatMap((ticket) => ticket.batches.map((batch) => batch.endAt))

  if (!dates.length) {
    return event.endDate
  }

  return dates.sort()[dates.length - 1]
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value))
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(value))
}

function renderMultilineText(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
}

function normalizeCategoryName(value: string) {
  return value.replace(/^kit\b/i, 'Categoria')
}

function resolveStravaRoutes(event: EventItem) {
  const configuredRoutes = event.pageSections.stravaRoutes
    .map((route) => ({
      title: route.title.trim(),
      url: route.url.trim() || parseStravaEmbedSnippet(route.embedCode)?.routeUrl || '',
      embed: parseStravaEmbedSnippet(route.embedCode),
    }))
    .filter((route): route is StravaRouteViewModel => Boolean(route.title && route.url))

  if (configuredRoutes.length > 0) {
    return configuredRoutes
  }

  const configuredEmbed = parseStravaEmbedSnippet(event.pageSections.stravaEmbedUrl)

  if (configuredEmbed) {
    return [{
      title: 'Percurso no Strava',
      url: configuredEmbed.routeUrl,
      embed: configuredEmbed,
    }]
  }

  const configuredRoute = parseStravaRouteUrl(event.pageSections.stravaEmbedUrl)

  if (configuredRoute) {
    return [{
      title: 'Percurso no Strava',
      url: configuredRoute.routeUrl,
      embed: null,
    }]
  }

  return [] as StravaRouteViewModel[]
}

function getEventStatusCopy(status: EventItem['status']) {
  if (status === 'closed') {
    return {
      title: 'Inscrições encerradas',
    }
  }

  return {
    title: 'Evento em rascunho',
  }
}

export function EventDetailsPage() {
  const { slug = '' } = useParams()
  const { token } = useAuth()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    setError('')

    api.getEventBySlug(slug)
      .then((response) => setEvent(response.event))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [slug])

  const firstBatch = useMemo(() => (event ? resolveFirstBatch(event) : null), [event])
  const registrationDeadline = useMemo(() => (event ? resolveRegistrationDeadline(event) : ''), [event])
  const ticketGroups = useMemo(() => {
    if (!event) {
      return [] as Array<{ groupId: string; groupName: string; tickets: EventItem['ticketTypes'] }>
    }

    const groups = new Map<string, { groupId: string; groupName: string; tickets: EventItem['ticketTypes'] }>()

    event.ticketTypes.forEach((ticket, index) => {
      const groupId = ticket.groupId || `group-${index}`
      const existingGroup = groups.get(groupId)

      if (existingGroup) {
        existingGroup.tickets.push(ticket)
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
  const fullAddress = useMemo(() => {
    if (!event) {
      return ''
    }

    return [event.addressLine, event.addressNumber, event.venue, event.city, event.state, event.country, event.zipCode]
      .filter(Boolean)
      .join(', ')
  }, [event])
  const mapQuery = useMemo(
    () => (event ? encodeURIComponent(fullAddress || `${event.venue}, ${event.city}, ${event.state}, ${event.country}`) : ''),
    [event, fullAddress],
  )
  const stravaRoutes = useMemo(() => (event ? resolveStravaRoutes(event) : []), [event])
  const stravaEmbeds = useMemo(() => stravaRoutes.map((route) => route.embed).filter((embed): embed is StravaEmbedConfig => Boolean(embed)), [stravaRoutes])

  useEffect(() => {
    if (!stravaEmbeds.length) {
      return
    }

    const existingScript = document.querySelector('script[data-strava-embed-script="true"]')

    if (existingScript) {
      existingScript.remove()
    }

    const script = document.createElement('script')
    script.src = 'https://strava-embeds.com/embed.js'
    script.async = true
    script.dataset.stravaEmbedScript = 'true'
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [stravaEmbeds])

  function renderSidebarCards(currentEvent: EventItem, className: string) {
    const eventStatusCopy = getEventStatusCopy(currentEvent.status)

    return (
      <aside className={className}>
        <div className="panel event-detail-sidebar__card">
          <strong>Inscrição</strong>
          <div className="event-detail-sidebar__stack">
            <div className="event-detail-sidebar__item">
              <small>Data do evento</small>
              <p>{formatDate(currentEvent.startDate)}</p>
            </div>
            <div className="event-detail-sidebar__item">
              <small>Inscrições até</small>
              <p>{formatDate(registrationDeadline)}</p>
            </div>
            {currentEvent.status === 'published' ? (
              <Link
                className="primary-button event-detail-sidebar__cta"
                to={token ? `/checkout/${currentEvent.slug}` : `/login?redirect=${encodeURIComponent(`/checkout/${currentEvent.slug}`)}`}
              >
                Inscreva-se
              </Link>
            ) : (
              <div className="event-detail-sidebar__status">
                <span className={`status-badge status-${currentEvent.status}`}>{eventStatusCopy.title}</span>
              </div>
            )}
            <div className="event-detail-sidebar__item">
              <small>Local do evento</small>
              <a href={currentEvent.mapUrl || `https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">
                {fullAddress || `${currentEvent.venue}, ${currentEvent.city}/${currentEvent.state}`}
              </a>
            </div>
            {firstBatch ? (
              <div className="event-detail-sidebar__item">
                <small>A partir de</small>
                <p>{formatCurrency(firstBatch.price)}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel event-detail-sidebar__card">
          <strong className="event-detail-sidebar__title">Já fez sua inscrição?</strong>
          <div className="event-detail-quick-links">
            <Link className="ghost-button" to="/atendimento">Dúvidas sobre a inscrição</Link>
            <Link className="ghost-button" to="/eventos">Ver outros eventos</Link>
            {currentEvent.operationalDetails.regulationUrl ? (
              <a className="ghost-button" href={currentEvent.operationalDetails.regulationUrl} target="_blank" rel="noreferrer">
                Regulamento
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    )
  }

  if (isLoading) {
    return (
      <div className="page-shell">
        <section className="content-section compact-top section-surface">
          <div className="panel panel--plain">Carregando evento...</div>
        </section>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="page-shell">
        <section className="content-section compact-top section-surface event-detail-empty">
          <div className="section-heading">
            <span className="eyebrow">Evento</span>
            <h1>Não foi possível abrir esse evento</h1>
            <p>{error || 'O evento solicitado não foi encontrado.'}</p>
          </div>
          <Link to="/eventos" className="primary-button">Voltar para eventos</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page-shell event-detail-page">
      <section className="content-section compact-top event-detail-layout">
        <div className="event-detail-main">
          {event.status !== 'published' ? (
            <div className="panel event-detail-preview-banner">
              <strong>{event.status === 'closed' ? 'Inscrições encerradas' : 'Pré-visualização de evento'}</strong>
            </div>
          ) : null}

          <header className="event-detail-heading">
            <span className="eyebrow">{categoryLabel(event.category)}</span>
            <h1>{event.title}</h1>
            <div className="event-detail-heading__meta">
              <div className="event-detail-organizer">
                <span className="event-detail-organizer__badge">{event.organizer.name.slice(0, 1)}</span>
                <div className="event-detail-organizer__content">
                  <small>Realizado por</small>
                  <strong>{event.organizer.name}</strong>
                </div>
              </div>
            </div>
          </header>

          <div className="event-detail-hero__media">
            <img src={event.coverImage} alt={event.title} />
          </div>

          {renderSidebarCards(event, 'event-detail-sidebar event-detail-sidebar--mobile')}

          <section className="event-detail-section">
            <h2>Sobre o evento</h2>

            <div className="event-detail-copy-stack">
              {event.pageSections.aboutEvent ? renderMultilineText(event.pageSections.aboutEvent) : <p>{event.description}</p>}
            </div>
            {event.highlights.length ? (
              <ul className="event-detail-bullets">
                {event.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
            ) : null}
          </section>

          {event.pageSections.routes ? (
            <section className="event-detail-section">
              <h2>Percursos</h2>
              <div className="event-detail-copy-stack">{renderMultilineText(event.pageSections.routes)}</div>
            </section>
          ) : null}

          <section className="event-detail-section">
            <h2>Inscrições</h2>
            {event.pageSections.registrations ? (
              <div className="event-detail-copy-stack">{renderMultilineText(event.pageSections.registrations)}</div>
            ) : (
              <p>As inscrições são realizadas conforme categoria e disponibilidade operacional. Confira os valores por lote e os detalhes de cada categoria.</p>
            )}
            <div className="event-detail-inline-note">
              <strong>Cancelamento</strong>
              <span>{event.cancellationPolicySummary || event.operationalDetails.cancellationPolicy}</span>
            </div>
            <div className="event-detail-categories event-detail-categories--stacked">
              {ticketGroups.map((group) => (
                <section key={group.groupId} className="event-detail-subsection">
                  <h3>{group.groupName}</h3>
                  <div className="event-detail-categories event-detail-categories--stacked">
                    {group.tickets.map((ticket) => {
                      const displayBatch = resolveDisplayBatch(ticket)

                      return (
                        <article key={ticket._id || `${group.groupId}-${ticket.name}`} className="event-detail-category-card">
                          <div className="event-detail-category-card__header">
                            <div>
                              <h4>{ticket.name}</h4>
                              <p>{ticket.description || 'Modalidade configurada para inscrição e operação do evento.'}</p>
                            </div>
                            <div className="event-detail-category-card__price">
                              <small>Valor atual</small>
                              <strong>{formatCurrency(displayBatch?.price || 0)}</strong>
                            </div>
                          </div>

                          <div className="event-detail-batch-list">
                            {ticket.batches.map((batch) => (
                              <div key={batch._id || `${ticket.name}-${batch.name}`} className="event-detail-batch-item">
                                <div>
                                  <strong>{batch.name}</strong>
                                  <span>{formatDateOnly(batch.endAt)}</span>
                                </div>
                                <div>
                                  <strong>{formatCurrency(batch.price)}</strong>
                                  <span>{batch.quantity} vagas</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {ticket.additionalQuestions.length ? (
                            <div className="event-detail-subsection">
                              <strong>Informações pedidas no cadastro</strong>
                              <ul className="event-detail-bullets">
                                {ticket.additionalQuestions.map((question) => (
                                  <li key={question._id || `${ticket.name}-${question.label}`}>
                                    {question.label}{question.required ? ' (obrigatória)' : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="event-detail-section">
            <h2>RETIRADA DOS KITS</h2>
            <div className="event-detail-copy-stack">
              {event.pageSections.kitDelivery ? renderMultilineText(event.pageSections.kitDelivery) : <p>{event.operationalDetails.checkInNotes || 'Informações de retirada dos kits ainda não definidas.'}</p>}
            </div>
          </section>

          {event.pageSections.awards ? (
            <section className="event-detail-section">
              <h2>Premiação</h2>
              <div className="event-detail-copy-stack">{renderMultilineText(event.pageSections.awards)}</div>
            </section>
          ) : null}

          {event.pageSections.schedule ? (
            <section className="event-detail-section">
              <h2>Programação</h2>
              <div className="event-detail-copy-stack">{renderMultilineText(event.pageSections.schedule)}</div>
            </section>
          ) : null}

          <section className="event-detail-section">
            <h2>Regulamento</h2>
            {event.pageSections.regulation ? (
              <div className="event-detail-copy-stack">{renderMultilineText(event.pageSections.regulation)}</div>
            ) : null}
            {event.operationalDetails.regulationUrl ? (
              <a className="text-link" href={event.operationalDetails.regulationUrl} target="_blank" rel="noreferrer">
                Clique aqui e confira o regulamento oficial do evento
              </a>
            ) : (
              <p>Regulamento ainda não disponibilizado.</p>
            )}
          </section>

          <section className="event-detail-section">
            <h2>Curiosidades</h2>
            <ul className="event-detail-bullets">
              <li>Evento com operação organizada por {event.organizer.name}.</li>
              <li>Local do evento: {fullAddress || `${event.venue}, ${event.city}/${event.state}` }.</li>
              <li>Prazo final previsto para inscrições: {formatDateOnly(registrationDeadline)}.</li>
              <li>{event.operationalDetails.cancellationPolicy || 'Política de cancelamento a definir pela organização.'}</li>
              <li>{event.operationalDetails.additionalQuestions || 'Mais informações serão compartilhadas nos canais oficiais do evento.'}</li>
            </ul>
          </section>

          {stravaRoutes.length ? (
            <section className="event-detail-section">
              <h2>Percursos no Strava</h2>
              <div className="event-detail-strava-routes">
                {stravaRoutes.map((route) => (
                  <div key={`${route.title}-${route.url}`} className="event-detail-strava-routes__item">
                    <strong>{route.title}</strong>
                    {route.embed ? (
                      <div className="event-detail-strava-routes__embed-shell">
                        <div
                          className="strava-embed-placeholder"
                          data-embed-type={route.embed.embedType}
                          data-embed-id={route.embed.embedId}
                          data-style={route.embed.style}
                          data-map-hash={route.embed.mapHash}
                          data-from-embed="true"
                          data-token={route.embed.token}
                        />
                      </div>
                    ) : null}
                    <a className="text-link" href={route.url} target="_blank" rel="noreferrer">
                      Abrir percurso no Strava
                    </a>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {renderSidebarCards(event, 'event-detail-sidebar event-detail-sidebar--desktop')}
      </section>
    </div>
  )
}