import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ModalDialog } from '../components/ModalDialog'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import type { RegistrationHistoryActionFilter, RegistrationHistoryActorFilter, RegistrationItem } from '../types'

const HISTORY_PAGE_SIZE = 4

function getHistoryLabel(action: RegistrationItem['history'][number]['action']) {
  switch (action) {
    case 'created':
      return 'Criação'
    case 'payment_confirmed':
      return 'Confirmação'
    case 'receipt_resent':
      return 'Reenvio'
    case 'cancelled':
      return 'Cancelamento'
    case 'refund_processed':
      return 'Estorno'
    case 'email_sent':
      return 'E-mail enviado'
    case 'email_failed':
      return 'Falha de e-mail'
  }
}

function getRegistrationStatusLabel(status: RegistrationItem['status']) {
  switch (status) {
    case 'confirmed':
      return 'Confirmada'
    case 'refunded':
      return 'Estornada'
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

function getRegistrationStatusClass(status: RegistrationItem['status']) {
  if (status === 'confirmed') {
    return 'status-published'
  }

  if (status === 'refunded') {
    return 'status-closed'
  }

  if (status === 'processing_payment' || status === 'pending_payment') {
    return 'status-draft'
  }

  return 'status-rejected'
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(downloadUrl)
}

export function SupportRegistrationsPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [eventIdFilter, setEventIdFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [mainHistoryActionFilter, setMainHistoryActionFilter] = useState('')
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [managedEvents, setManagedEvents] = useState<Array<{ _id: string; title: string }>>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState('')
  const [actionType, setActionType] = useState<'download' | 'resend' | 'cancel' | ''>('')
  const [cancelTarget, setCancelTarget] = useState<RegistrationItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [historyActionFilters, setHistoryActionFilters] = useState<Record<string, RegistrationHistoryActionFilter>>({})
  const [historyActorFilters, setHistoryActorFilters] = useState<Record<string, RegistrationHistoryActorFilter>>({})
  const [historyPages, setHistoryPages] = useState<Record<string, number>>({})

  function getFilteredHistory(registration: RegistrationItem) {
    const actionFilter = historyActionFilters[registration._id] || 'all'
    const actorFilter = historyActorFilters[registration._id] || 'all'

    return registration.history
      .slice()
      .reverse()
      .filter((entry) => (actionFilter === 'all' ? true : entry.action === actionFilter))
      .filter((entry) => (actorFilter === 'all' ? true : entry.actorRole === actorFilter))
  }

  function getHistoryPage(registrationId: string) {
    return historyPages[registrationId] || 1
  }

  function setHistoryPage(registrationId: string, page: number) {
    setHistoryPages((current) => ({
      ...current,
      [registrationId]: Math.max(page, 1),
    }))
  }

  function setHistoryActionFilter(registrationId: string, value: RegistrationHistoryActionFilter) {
    setHistoryActionFilters((current) => ({
      ...current,
      [registrationId]: value,
    }))
    setHistoryPage(registrationId, 1)
  }

  function setHistoryActorFilter(registrationId: string, value: RegistrationHistoryActorFilter) {
    setHistoryActorFilters((current) => ({
      ...current,
      [registrationId]: value,
    }))
    setHistoryPage(registrationId, 1)
  }

  async function loadRegistrations(searchQuery = query, statusFilter = status, page = pagination.page) {
    if (!token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const response = await api.searchSupportRegistrations(token, {
        q: searchQuery.trim(),
        status: statusFilter,
        eventId: eventIdFilter,
        paymentMethod: paymentMethodFilter,
        historyAction: mainHistoryActionFilter,
        page,
        limit: pagination.limit,
      })

      setRegistrations(response.registrations)
      setPagination(response.pagination)
      setError('')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel localizar inscricoes.'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadRegistrations()
  }, [token])

  useEffect(() => {
    if (!token) {
      return
    }

    api.getManagedEvents(token)
      .then((response) => setManagedEvents(response.events.map((event) => ({ _id: event._id, title: event.title }))))
      .catch(() => setManagedEvents([]))
  }, [token])

  function exportHistoryCsv() {
    const rows = [
      ['pedido', 'evento', 'participante', 'status', 'acao', 'origem', 'data', 'descricao'].join(';'),
      ...registrations.flatMap((registration) =>
        registration.history
          .filter((entry) => (mainHistoryActionFilter ? entry.action === mainHistoryActionFilter : true))
          .map((entry) => [
            registration.orderNumber,
            registration.event.title,
            registration.participant.fullName,
            registration.status,
            entry.action,
            entry.actorRole,
            entry.createdAt,
            `"${entry.description.replace(/"/g, '""')}"`,
          ].join(';')),
      ),
    ]

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    triggerBrowserDownload(blob, 'historico-operacional-inscricoes.csv')
    toast.success('Histórico operacional exportado em CSV.')
  }

  async function handleDownloadReceipt(registration: RegistrationItem) {
    if (!token) {
      return
    }

    setActionId(registration._id)
    setActionType('download')

    try {
      const blob = await api.downloadRegistrationReceipt(token, registration._id)
      triggerBrowserDownload(blob, `comprovante-inscricao-${registration.orderNumber}.pdf`)
      toast.success('Comprovante baixado com sucesso.')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel baixar o comprovante.'
      toast.error(message)
    } finally {
      setActionId('')
      setActionType('')
    }
  }

  async function handleResendReceipt(registration: RegistrationItem) {
    if (!token) {
      return
    }

    setActionId(registration._id)
    setActionType('resend')

    try {
      const response = await api.resendRegistrationReceipt(token, registration._id)
      toast.success(response.message)
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel reenviar o comprovante.'
      toast.error(message)
    } finally {
      setActionId('')
      setActionType('')
    }
  }

  async function handleCancelRegistration(registration: RegistrationItem) {
    if (!registration) {
      return
    }

    setCancelTarget(registration)
    setCancelReason(registration.cancellationReason || '')
  }

  async function confirmCancelRegistration() {
    if (!token || !cancelTarget) {
      return
    }

    setActionId(cancelTarget._id)
    setActionType('cancel')

    try {
      const response = await api.cancelRegistrationFromSupport(token, cancelTarget._id, { reason: cancelReason.trim() })

      setRegistrations((current) => current.map((item) => item._id === cancelTarget._id ? response.registration : item))
      toast.success(response.message)
      setCancelTarget(null)
      setCancelReason('')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel cancelar a inscricao.'
      toast.error(message)
    } finally {
      setActionId('')
      setActionType('')
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadRegistrations(query, status, 1)
  }

  return (
    <>
      <section className="content-section compact-top">
        <div className="section-heading">
          <span className="eyebrow">Backoffice</span>
          <h1>Suporte de inscrições</h1>
          <p>Localize rapidamente uma inscrição por pedido, participante, e-mail ou evento e resolva reenvios, cancelamentos e estornos.</p>
        </div>

      <form className="panel support-search-form" onSubmit={handleSubmit}>
        <label>
          <span>Busca operacional</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pedido, nome, e-mail ou titulo do evento"
          />
        </label>

        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="confirmed">Confirmada</option>
            <option value="processing_payment">Processando</option>
            <option value="pending_payment">Pendente</option>
            <option value="payment_failed">Falhou</option>
            <option value="cancelled">Cancelada</option>
            <option value="refunded">Estornada</option>
          </select>
        </label>

        <label>
          <span>Evento</span>
          <select value={eventIdFilter} onChange={(event) => setEventIdFilter(event.target.value)}>
            <option value="">Todos</option>
            {managedEvents.map((event) => (
              <option key={event._id} value={event._id}>{event.title}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Pagamento</span>
          <select value={paymentMethodFilter} onChange={(event) => setPaymentMethodFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="stripe">Stripe</option>
            <option value="pix">Pix</option>
            <option value="credit_card">Cartão</option>
          </select>
        </label>

        <label>
          <span>Ação principal</span>
          <select value={mainHistoryActionFilter} onChange={(event) => setMainHistoryActionFilter(event.target.value)}>
            <option value="">Todas</option>
            <option value="created">Criação</option>
            <option value="payment_confirmed">Confirmação</option>
            <option value="receipt_resent">Reenvio</option>
            <option value="cancelled">Cancelamento</option>
            <option value="refund_processed">Estorno</option>
            <option value="email_sent">E-mail enviado</option>
            <option value="email_failed">Falha de e-mail</option>
          </select>
        </label>

        <button type="submit" className="primary-button support-search-form__submit" disabled={isLoading}>
          {isLoading ? 'Buscando...' : 'Buscar inscrições'}
        </button>
        <button type="button" className="ghost-button support-search-form__submit" onClick={exportHistoryCsv} disabled={registrations.length === 0}>
          Exportar histórico CSV
        </button>
      </form>

      {error ? <div className="error-inline">{error}</div> : null}

      {isLoading ? (
        <div className="panel panel--plain">Carregando inscrições...</div>
      ) : registrations.length === 0 ? (
        <div className="panel panel--plain empty-state">
          <strong>Nenhuma inscrição encontrada.</strong>
          <p>Ajuste os filtros ou pesquise por outro dado operacional.</p>
        </div>
      ) : (
        <>
        <div className="support-pagination-bar">
          <small>{pagination.total} inscrição(ões) encontradas</small>
          <div>
            <button type="button" className="ghost-button" onClick={() => void loadRegistrations(query, status, pagination.page - 1)} disabled={pagination.page <= 1 || isLoading}>Anterior</button>
            <span>Página {pagination.page} de {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" className="ghost-button" onClick={() => void loadRegistrations(query, status, pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || isLoading}>Próxima</button>
          </div>
        </div>
        <div className="registration-list">
          {registrations.map((registration) => {
            const isDownloading = actionId === registration._id && actionType === 'download'
            const isResending = actionId === registration._id && actionType === 'resend'
            const isCancelling = actionId === registration._id && actionType === 'cancel'

            return (
              <article key={registration._id} className="registration-card">
                <div className="registration-card__header">
                  <div className="registration-card__headline">
                    <span className="registration-card__location">{registration.event.city}/{registration.event.state}</span>
                    <h3>{registration.event.title}</h3>
                    <p>{registration.selection.groupName} • {registration.selection.ticketName}</p>
                  </div>
                  <span className={`status-badge ${getRegistrationStatusClass(registration.status)}`}>
                    {getRegistrationStatusLabel(registration.status)}
                  </span>
                </div>

                <div className="registration-card__details">
                  <strong>{registration.participant.fullName}</strong>
                  <span>{registration.participant.email}</span>
                </div>

                <div className="registration-card__metrics">
                  <div className="registration-card__metric">
                    <span className="registration-card__metric-label">Inscrição</span>
                    <strong>#{registration.orderNumber}</strong>
                  </div>
                  <div className="registration-card__metric">
                    <span className="registration-card__metric-label">Evento</span>
                    <strong>{formatDate(registration.event.startDate)}</strong>
                  </div>
                  <div className="registration-card__metric">
                    <span className="registration-card__metric-label">Total</span>
                    <strong>{formatCurrency(registration.totalAmount)}</strong>
                  </div>
                  <div className="registration-card__metric">
                    <span className="registration-card__metric-label">Confirmada em</span>
                    <strong>{formatDate(registration.refundedAt || registration.paidAt || registration.cancelledAt || registration.createdAt)}</strong>
                  </div>
                </div>

                {registration.cancellationReason ? (
                  <div className="panel panel--plain">
                    <strong>Motivo operacional</strong>
                    <p>{registration.cancellationReason}</p>
                  </div>
                ) : null}

                {registration.cancellationPolicy ? (
                  <div className="panel panel--plain registration-policy-card">
                    <strong>Política vigente</strong>
                    <p>{registration.cancellationPolicy.summary}</p>
                    <small>{registration.cancellationPolicy.currentRuleLabel}</small>
                  </div>
                ) : null}

                {registration.history.length ? (
                  <div className="panel panel--plain registration-history-card">
                    <div className="registration-history-card__header">
                      <strong>Histórico operacional</strong>
                      <div className="registration-history-toolbar">
                        <label>
                          <span>Tipo</span>
                          <select
                            value={historyActionFilters[registration._id] || 'all'}
                            onChange={(event) => setHistoryActionFilter(registration._id, event.target.value as RegistrationHistoryActionFilter)}
                          >
                            <option value="all">Todos</option>
                            <option value="created">Criação</option>
                            <option value="payment_confirmed">Confirmação</option>
                            <option value="receipt_resent">Reenvio</option>
                            <option value="cancelled">Cancelamento</option>
                            <option value="refund_processed">Estorno</option>
                            <option value="email_sent">E-mail enviado</option>
                            <option value="email_failed">Falha de e-mail</option>
                          </select>
                        </label>

                        <label>
                          <span>Origem</span>
                          <select
                            value={historyActorFilters[registration._id] || 'all'}
                            onChange={(event) => setHistoryActorFilter(registration._id, event.target.value as RegistrationHistoryActorFilter)}
                          >
                            <option value="all">Todas</option>
                            <option value="system">Sistema</option>
                            <option value="customer">Participante</option>
                            <option value="event_admin">Admin do evento</option>
                            <option value="super_admin">Super admin</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="registration-history-list">
                      {getFilteredHistory(registration)
                        .slice((getHistoryPage(registration._id) - 1) * HISTORY_PAGE_SIZE, getHistoryPage(registration._id) * HISTORY_PAGE_SIZE)
                        .map((entry) => (
                        <div key={entry._id || `${entry.action}-${entry.createdAt}`} className="registration-history-item">
                          <div>
                            <span>{getHistoryLabel(entry.action)}</span>
                            <p>{entry.description}</p>
                          </div>
                          <small>{formatDate(entry.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                    <div className="registration-history-pagination">
                      <small>
                        {getFilteredHistory(registration).length} registro(s) encontrado(s)
                      </small>
                      <div>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setHistoryPage(registration._id, getHistoryPage(registration._id) - 1)}
                          disabled={getHistoryPage(registration._id) <= 1}
                        >
                          Anterior
                        </button>
                        <span>
                          Página {getHistoryPage(registration._id)} de {Math.max(Math.ceil(getFilteredHistory(registration).length / HISTORY_PAGE_SIZE), 1)}
                        </span>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setHistoryPage(registration._id, getHistoryPage(registration._id) + 1)}
                          disabled={getHistoryPage(registration._id) >= Math.max(Math.ceil(getFilteredHistory(registration).length / HISTORY_PAGE_SIZE), 1)}
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="registration-card__actions">
                  {registration.status === 'confirmed' ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleDownloadReceipt(registration)}
                      disabled={isDownloading || isResending}
                    >
                      {isDownloading ? 'Baixando...' : 'Baixar comprovante'}
                    </button>
                  ) : null}

                  {registration.status === 'confirmed' ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleResendReceipt(registration)}
                      disabled={isDownloading || isResending}
                    >
                      {isResending ? 'Reenviando...' : 'Reenviar por e-mail'}
                    </button>
                  ) : null}

                  {registration.status === 'confirmed' || registration.status === 'pending_payment' || registration.status === 'processing_payment' ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleCancelRegistration(registration)}
                      disabled={isDownloading || isResending || isCancelling}
                    >
                      {isCancelling
                        ? 'Processando...'
                        : registration.status === 'confirmed' && registration.totalAmount > 0
                          ? 'Cancelar e estornar'
                          : 'Cancelar inscrição'}
                    </button>
                  ) : null}

                  <Link className="ghost-button" to={`/e/${registration.event.slug}`}>
                    Ver evento
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
        </>
      )}
      </section>

      <ModalDialog
        isOpen={Boolean(cancelTarget)}
        title={cancelTarget ? `Cancelar inscrição #${cancelTarget.orderNumber}` : 'Cancelar inscrição'}
        description={cancelTarget?.status === 'confirmed' && (cancelTarget?.cancellationPolicy?.currentRefundAmount || 0) > 0
          ? 'Essa ação processará o cancelamento e o estorno calculado para o momento atual.'
          : 'Essa ação cancelará a inscrição no estado atual.'}
        confirmLabel="Confirmar cancelamento"
        cancelLabel="Voltar"
        tone="danger"
        onClose={() => {
          setCancelTarget(null)
          setCancelReason('')
        }}
        onConfirm={() => void confirmCancelRegistration()}
        isSubmitting={Boolean(cancelTarget && actionId === cancelTarget._id && actionType === 'cancel')}
      >
        {cancelTarget ? (
          <div className="modal-dialog__stack">
            <div className="panel panel--plain modal-dialog__notice">
              <strong>Regra vigente</strong>
              <p>{cancelTarget.cancellationPolicy?.currentRuleLabel || 'O sistema aplicará a regra automática vigente.'}</p>
            </div>
            <label>
              <span>Motivo do cancelamento (opcional)</span>
              <textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
            </label>
          </div>
        ) : null}
      </ModalDialog>
    </>
  )
}