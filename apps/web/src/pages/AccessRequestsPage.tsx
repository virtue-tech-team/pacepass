import { useEffect, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { formatDate } from '../lib/format'
import { api } from '../lib/api'
import type { EventRequestItem } from '../types'

const sportLabels: Record<EventRequestItem['sportCategory'], string> = {
  road_running: 'Corrida de rua / caminhada',
  cycling: 'Ciclismo / MTB',
  obstacle_race: 'Corrida de obstáculos',
  kids_race: 'Corrida kids',
  canoeing: 'Canoagem / VAA',
  virtual_challenges: 'Desafios virtuais',
  swimming: 'Natação / travessia',
  trail_run: 'Trail run / montanha',
  triathlon: 'Triathlon / duathlon',
  surf: 'Surf',
  courses: 'Cursos',
  other_sports: 'Outros eventos esportivos',
  other_events: 'Outros eventos em geral',
}

const volumeLabels: Record<EventRequestItem['eventsPerYear'], string> = {
  '1': '1 evento',
  '2_4': '2 a 4 eventos',
  '5_10': '5 a 10 eventos',
  '10_plus': 'Acima de 10 eventos',
}

export function AccessRequestsPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState<EventRequestItem[]>([])
  const [error, setError] = useState('')
  const [updatingRequestId, setUpdatingRequestId] = useState('')

  useEffect(() => {
    if (!token) return

    api.listEventRequests(token)
      .then((response) => setRequests(response.requests))
      .catch((err: Error) => {
        setError(err.message)
        toast.error(err.message)
      })
  }, [token, toast])

  async function handleUpdateStatus(request: EventRequestItem, status: 'approved' | 'rejected') {
    if (!token) {
      return
    }

    setUpdatingRequestId(request._id)
    setError('')

    try {
      const response = await api.updateEventRequestStatus(token, request._id, status)
      setRequests((current) => current.map((item) => item._id === request._id ? response.request : item))
      toast.success(response.message)
    } catch (currentError) {
      const message = (currentError as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setUpdatingRequestId('')
    }
  }

  return (
    <section className="content-section compact-top">
      <div className="section-heading inline-heading">
        <div>
          <span className="eyebrow">Solicitações</span>
          <h1>Solicitações de acesso</h1>
          <p>Triagem inicial dos organizadores que pediram liberação para cadastrar eventos.</p>
        </div>
      </div>

      {error ? <div className="panel error-panel">{error}</div> : null}

      <div className="compact-grid">
        <article className="panel">
          <strong>Total recebido</strong>
          <p className="module-metric">{requests.length}</p>
          <small>Solicitações registradas na base</small>
        </article>
        <article className="panel">
          <strong>Pendentes</strong>
          <p className="module-metric">{requests.filter((item) => item.status === 'pending').length}</p>
          <small>Aguardando análise comercial</small>
        </article>
      </div>

      {requests.length ? (
        <div className="list-stack">
          {requests.map((request) => (
            <article key={request._id} className="panel module-list-card">
              <div className="list-row module-list-card__header">
                <div>
                  <strong>{request.eventName}</strong>
                  <small>{request.company} • {request.region}</small>
                </div>
                <span className={`status-badge status-${request.status}`}>{request.status}</span>
              </div>

              <div className="module-list-card__grid">
                <div>
                  <small>Responsável</small>
                  <p>{request.fullName}</p>
                </div>
                <div>
                  <small>Contato</small>
                  <p>{request.email}</p>
                </div>
                <div>
                  <small>Modalidade</small>
                  <p>{sportLabels[request.sportCategory]}</p>
                </div>
                <div>
                  <small>Volume anual</small>
                  <p>{volumeLabels[request.eventsPerYear]}</p>
                </div>
                <div>
                  <small>Recebido em</small>
                  <p>{formatDate(request.createdAt)}</p>
                </div>
                <div>
                  <small>Indicação</small>
                  <p>{request.referralName || 'Sem indicação'}</p>
                </div>
              </div>

              {request.status === 'pending' ? (
                <div className="module-list-card__actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleUpdateStatus(request, 'rejected')}
                    disabled={updatingRequestId === request._id}
                  >
                    {updatingRequestId === request._id ? 'Atualizando...' : 'Rejeitar'}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleUpdateStatus(request, 'approved')}
                    disabled={updatingRequestId === request._id}
                  >
                    {updatingRequestId === request._id ? 'Atualizando...' : 'Aprovar'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel panel--plain empty-state">
          <strong>Nenhuma solicitação recebida até agora.</strong>
          <p>Quando novos organizadores preencherem o formulário, eles aparecerão aqui para triagem.</p>
        </div>
      )}
    </section>
  )
}