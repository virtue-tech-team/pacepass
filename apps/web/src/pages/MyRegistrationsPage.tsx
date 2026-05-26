import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ModalDialog } from '../components/ModalDialog'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import type { RegistrationItem } from '../types'

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

export function MyRegistrationsPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionId, setActionId] = useState('')
  const [actionType, setActionType] = useState<'download' | 'resend' | 'cancel' | ''>('')
  const [cancelTarget, setCancelTarget] = useState<RegistrationItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    api.listMyRegistrations(token)
      .then((response) => {
        setRegistrations(response.registrations)
        setError('')
      })
      .catch((currentError: Error) => {
        setError(currentError.message)
        toast.error(currentError.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [token])

  async function handleDownloadPdf(registration: RegistrationItem) {
    if (!token) {
      return
    }

    setActionId(registration._id)
    setActionType('download')
    setActionError('')

    try {
      const blob = await api.downloadRegistrationReceipt(token, registration._id)
      triggerBrowserDownload(blob, `comprovante-inscricao-${registration.orderNumber}.pdf`)
      toast.success('Comprovante baixado com sucesso.')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel baixar o comprovante.'
      setActionError(message)
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
    setActionError('')

    try {
      const response = await api.resendRegistrationReceipt(token, registration._id)
      toast.success(response.message)
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel reenviar o comprovante.'
      setActionError(message)
      toast.error(message)
    } finally {
      setActionId('')
      setActionType('')
    }
  }

  async function handleCancelRegistration(registration: RegistrationItem) {
    if (!registration.cancellationPolicy) {
      return
    }

    setCancelTarget(registration)
    setCancelReason('')
  }

  async function confirmCancelRegistration() {
    if (!token || !cancelTarget) {
      return
    }

    setActionId(cancelTarget._id)
    setActionType('cancel')
    setActionError('')

    try {
      const response = await api.cancelMyRegistration(token, cancelTarget._id, { reason: cancelReason.trim() })
      setRegistrations((current) => current.map((item) => item._id === cancelTarget._id ? response.registration : item))
      toast.success(response.message)
      setCancelTarget(null)
      setCancelReason('')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Nao foi possivel cancelar a inscricao.'
      setActionError(message)
      toast.error(message)
    } finally {
      setActionId('')
      setActionType('')
    }
  }

  if (isLoading) {
    return (
      <section className="content-section compact-top">
        <div className="panel panel--plain">Carregando inscrições...</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="content-section compact-top">
        <div className="panel panel--plain empty-state">
          <strong>Não foi possível carregar suas inscrições.</strong>
          <p>{error}</p>
        </div>
      </section>
    )
  }

  if (registrations.length === 0) {
    return (
      <section className="content-section compact-top">
        <div className="section-heading">
          <span className="eyebrow">Inscrições</span>
          <h1>Minhas inscrições</h1>
          <p>Área preparada para histórico de compras, confirmações e status de participação.</p>
        </div>

        <div className="panel panel--plain empty-state">
          <strong>Você ainda não tem inscrições registradas.</strong>
          <p>Assim que concluir uma inscrição, ela aparecerá aqui com os dados do evento e do participante.</p>
          <Link className="primary-button" to="/eventos">
            Explorar eventos disponíveis
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="content-section compact-top">
        <div className="section-heading">
          <span className="eyebrow">Inscrições</span>
          <h1>Minhas inscrições</h1>
        </div>

        {actionError ? <div className="error-inline">{actionError}</div> : null}

        <div className="registration-list">
          {registrations.map((registration) => (
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
              <strong>{formatDate(registration.event.startDate)}</strong>
              <span>{registration.event.venue}</span>
            </div>

            <div className="registration-card__metrics">
              <div className="registration-card__metric">
                <span className="registration-card__metric-label">Inscrição</span>
                <strong>#{registration.orderNumber}</strong>
              </div>
              <div className="registration-card__metric">
                <span className="registration-card__metric-label">Participante</span>
                <strong>{registration.participant.fullName}</strong>
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

            {registration.cancellationPolicy ? (
              <div className="panel panel--plain registration-policy-card">
                <strong>Política de cancelamento</strong>
                <p>{registration.cancellationPolicy.summary}</p>
                <small>{registration.cancellationPolicy.currentRuleLabel}</small>
              </div>
            ) : null}

            <div className="registration-card__actions">
              {registration.status === 'confirmed' ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleDownloadPdf(registration)}
                    disabled={actionId === registration._id}
                  >
                    {actionId === registration._id && actionType === 'download' ? 'Baixando...' : 'Baixar comprovante'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleResendReceipt(registration)}
                    disabled={actionId === registration._id}
                  >
                    {actionId === registration._id && actionType === 'resend' ? 'Reenviando...' : 'Reenviar por e-mail'}
                  </button>
                </>
              ) : null}
              {registration.status === 'confirmed' || registration.status === 'pending_payment' || registration.status === 'processing_payment' ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleCancelRegistration(registration)}
                  disabled={actionId === registration._id}
                >
                  {actionId === registration._id && actionType === 'cancel'
                    ? 'Processando...'
                    : registration.cancellationPolicy?.currentRefundAmount
                      ? 'Cancelar inscrição'
                      : 'Cancelar sem estorno'}
                </button>
              ) : null}
              <Link className="ghost-button" to={`/e/${registration.event.slug}`}>
                Ver evento
              </Link>
            </div>
            </article>
          ))}
        </div>
      </section>

      <ModalDialog
        isOpen={Boolean(cancelTarget)}
        title={cancelTarget ? `Cancelar inscrição #${cancelTarget.orderNumber}` : 'Cancelar inscrição'}
        description={cancelTarget?.cancellationPolicy?.currentRuleLabel}
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
              <strong>Previsão atual</strong>
              <p>
                {cancelTarget.cancellationPolicy?.currentRefundAmount
                  ? `Se cancelar agora, o estorno previsto é de ${formatCurrency(cancelTarget.cancellationPolicy.currentRefundAmount)}.`
                  : 'Se cancelar agora, não há estorno financeiro previsto.'}
              </p>
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