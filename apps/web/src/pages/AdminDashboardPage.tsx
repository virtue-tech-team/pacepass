import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StatsGrid } from '../components/StatsGrid'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { DashboardSummary } from '../types'

export function AdminDashboardPage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')

  async function loadData() {
    if (!token) return

    const summaryResponse = await api.getDashboardSummary(token)
    setSummary(summaryResponse.summary)
  }

  useEffect(() => {
    if (!token) return

    loadData().catch((err: Error) => setError(err.message))
  }, [token])

  return (
    <section className="content-section compact-top">
      <div className="section-heading">
        <span className="eyebrow">Painel central</span>
        <h1>Operação central</h1>
        <p>Resumo executivo da plataforma com atalhos para cada frente operacional.</p>
      </div>
      {error ? <div className="panel error-panel">{error}</div> : null}
      {summary ? (
        <StatsGrid
          items={[
            { label: 'Usuários', value: summary.users, detail: 'Base total cadastrada' },
            { label: 'Eventos', value: summary.events, detail: 'Todos os eventos cadastrados' },
            { label: 'Publicados', value: summary.publishedEvents, detail: 'Prontos para venda' },
          ]}
        />
      ) : null}

      <div className="feature-grid">
        <article className="panel admin-overview-card">
          <span className="eyebrow">Organizadores</span>
          <h2>Gestão de organizadores</h2>
          <p>Cadastre novos organizadores, ajuste taxa comercial e mantenha a carteira da plataforma organizada em uma página própria.</p>
          <Link to="/organizadores" className="primary-button admin-overview-card__action">Abrir gestão de organizadores</Link>
        </article>
        <article className="panel admin-overview-card">
          <span className="eyebrow">Eventos</span>
          <h2>Eventos cadastrados</h2>
          <p>Veja os eventos da base com mais espaço visual, cards dedicados e leitura melhor da operação sem poluir o painel principal.</p>
          <Link to="/eventos-cadastrados" className="primary-button admin-overview-card__action">Abrir eventos cadastrados</Link>
        </article>
        <article className="panel admin-overview-card admin-overview-card--muted">
          <span className="eyebrow">Aprovações</span>
          <h2>Solicitações de acesso</h2>
          <p>Continue a triagem comercial dos novos organizadores em um fluxo isolado, sem misturar aprovação com cadastro e operação.</p>
          <Link to="/solicitacoes-acesso" className="ghost-button admin-overview-card__action">Ver solicitações</Link>
        </article>
      </div>
    </section>
  )
}