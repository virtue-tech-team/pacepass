import { useEffect, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import type { FinancialSummaryResponse, OperationsReadinessResponse } from '../types'

export function FinancePage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<FinancialSummaryResponse | null>(null)
  const [operations, setOperations] = useState<OperationsReadinessResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    Promise.all([api.getFinancialSummary(token), api.getOperationsReadiness(token)])
      .then(([financialResponse, operationsResponse]) => {
        setSummary(financialResponse)
        setOperations(operationsResponse)
      })
      .catch((err: Error) => setError(err.message))
  }, [token])

  const totals = summary?.totals

  return (
    <section className="content-section compact-top">
      <div className="section-heading">
        <span className="eyebrow">Financeiro</span>
        <h1>Resumo financeiro operacional</h1>
        <p>Visão inicial de capacidade, receita potencial e próximos eventos para gestão financeira.</p>
      </div>

      {error ? <div className="panel error-panel">{error}</div> : null}

      <div className="stats-grid">
        <article className="stat-card">
          <strong>Bruto conciliado</strong>
          <p className="module-metric">{formatCurrency(totals?.organizerGross || 0)}</p>
          <small>Base efetivamente vendida antes dos estornos</small>
        </article>
        <article className="stat-card">
          <strong>Taxas conciliadas</strong>
          <p className="module-metric">{formatCurrency(totals?.platformFees || 0)}</p>
          <small>Receita real de taxa antes dos abatimentos</small>
        </article>
        <article className="stat-card">
          <strong>Repasse líquido</strong>
          <p className="module-metric">{formatCurrency(totals?.organizerNet || 0)}</p>
          <small>Repasse líquido após estornos</small>
        </article>
        <article className="stat-card">
          <strong>Estornos</strong>
          <p className="module-metric">{formatCurrency(totals?.refundedTotal || 0)}</p>
          <small>Total devolvido aos compradores</small>
        </article>
        <article className="stat-card">
          <strong>Confirmadas</strong>
          <p className="module-metric">{totals?.confirmedCount || 0}</p>
          <small>Inscrições realmente conciliadas</small>
        </article>
      </div>

      <div className="list-stack">
        {summary?.events.map((event) => {
          return (
            <article key={event.eventId} className="panel module-list-card">
              <div className="list-row module-list-card__header">
                <div>
                  <strong>{event.eventTitle}</strong>
                  <small>{event.city}/{event.state} • {event.status === 'published' ? 'Publicado' : event.status === 'draft' ? 'Rascunho' : 'Encerrado'} • {formatDate(event.eventDate)}</small>
                </div>
                <span className="status-badge status-published">{event.confirmedCount} confirmadas</span>
              </div>

              <div className="module-list-card__grid">
                <div>
                  <small>Receita base</small>
                  <p>{formatCurrency(event.organizerGross)}</p>
                </div>
                <div>
                  <small>Taxas da plataforma</small>
                  <p>{formatCurrency(event.platformFees)}</p>
                </div>
                <div>
                  <small>Total cobrado do cliente</small>
                  <p>{formatCurrency(event.buyerCharged)}</p>
                </div>
                <div>
                  <small>Repasse do organizador</small>
                  <p>{formatCurrency(event.organizerNet)}</p>
                </div>
                <div>
                  <small>Estornos</small>
                  <p>{formatCurrency(event.refundedTotal)} • {event.refundedCount} caso(s)</p>
                </div>
                <div>
                  <small>Status operacional</small>
                  <p>Pendentes {event.pendingCount} • Canceladas {event.cancelledCount} • Falhas {event.failedCount}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {operations ? (
        <div className="feature-grid finance-monitor-grid">
          <article className="panel admin-overview-card">
            <span className="eyebrow">Lançamento</span>
            <h2>Checklist operacional</h2>
            <div className="finance-checklist">
              {operations.checklist.map((item) => (
                <div key={item.key} className="finance-checklist__item">
                  <strong>{item.label}</strong>
                  <span className={`status-badge ${item.status === 'ready' ? 'status-published' : 'status-rejected'}`}>
                    {item.status === 'ready' ? 'Pronto' : 'Atenção'}
                  </span>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel admin-overview-card">
            <span className="eyebrow">Monitoramento</span>
            <h2>Webhook, e-mail e saúde</h2>
            <div className="finance-checklist">
              <div className="finance-checklist__item">
                <strong>Webhook Stripe</strong>
                <small>{operations.activity.latestWebhookActivityAt ? `Última atividade em ${formatDate(operations.activity.latestWebhookActivityAt)}` : 'Sem atividade registrada ainda.'}</small>
              </div>
              <div className="finance-checklist__item">
                <strong>E-mail transacional</strong>
                <small>{operations.activity.latestEmailActivityAt ? `Última atividade em ${formatDate(operations.activity.latestEmailActivityAt)}` : 'Sem atividade registrada ainda.'}</small>
              </div>
              <div className="finance-checklist__item">
                <strong>Falhas de e-mail 24h</strong>
                <small>{operations.activity.emailFailuresLast24h} ocorrência(s) no período</small>
              </div>
              <div className="finance-checklist__item">
                <strong>Banco / API</strong>
                <small>API {operations.health.api} • Mongo {operations.health.database}</small>
              </div>
            </div>
          </article>

          <article className="panel admin-overview-card admin-overview-card--muted finance-audit-card">
            <span className="eyebrow">Auditoria</span>
            <h2>Últimas ações administrativas</h2>
            <div className="registration-history-list">
              {operations.recentAdminAudit.length ? operations.recentAdminAudit.map((entry) => (
                <div key={`${entry.registrationId}-${entry.createdAt}`} className="registration-history-item">
                  <div>
                    <span>{entry.actorRole === 'super_admin' ? 'Super admin' : 'Admin do evento'} • #{entry.orderNumber}</span>
                    <p>{entry.description}</p>
                    <small>{entry.eventTitle}</small>
                  </div>
                  <small>{formatDate(entry.createdAt)}</small>
                </div>
              )) : <small>Nenhuma ação administrativa recente encontrada.</small>}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}