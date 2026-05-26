import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { CreateEventRequestInput } from '../types'

const regionOptions = [
  'Acre',
  'Alagoas',
  'Amapá',
  'Amazonas',
  'Bahia',
  'Ceará',
  'Distrito Federal',
  'Espírito Santo',
  'Goiás',
  'Maranhão',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Minas Gerais',
  'Pará',
  'Paraíba',
  'Paraná',
  'Pernambuco',
  'Piauí',
  'Rio de Janeiro',
  'Rio Grande do Norte',
  'Rio Grande do Sul',
  'Rondônia',
  'Roraima',
  'Santa Catarina',
  'São Paulo',
  'Sergipe',
  'Tocantins',
] as const

const sportOptions: Array<{ value: CreateEventRequestInput['sportCategory']; label: string }> = [
  { value: 'road_running', label: 'Corrida de Rua / Caminhada' },
  { value: 'cycling', label: 'Ciclismo / MTB' },
  { value: 'obstacle_race', label: 'Corrida de Obstáculos' },
  { value: 'kids_race', label: 'Corrida Kids' },
  { value: 'canoeing', label: 'Canoagem / VAA' },
  { value: 'virtual_challenges', label: 'Desafios Virtuais' },
  { value: 'swimming', label: 'Natação / Travessia' },
  { value: 'trail_run', label: 'Trail Run / Corrida de Montanha' },
  { value: 'triathlon', label: 'Triathlon / Duathlon' },
  { value: 'surf', label: 'Surf' },
  { value: 'courses', label: 'Cursos' },
  { value: 'other_sports', label: 'Outros eventos esportivos' },
  { value: 'other_events', label: 'Outros eventos em geral' },
]

const eventVolumeOptions: Array<{ value: CreateEventRequestInput['eventsPerYear']; label: string }> = [
  { value: '1', label: '1 evento' },
  { value: '2_4', label: '2 - 4 eventos' },
  { value: '5_10', label: '5 - 10 eventos' },
  { value: '10_plus', label: 'Acima de 10 eventos' },
]

const regulationOptions: Array<{ value: CreateEventRequestInput['regulationStatus']; label: string }> = [
  { value: 'ready', label: 'Sim, tenho regulamento do evento' },
  { value: 'not_ready', label: 'Meu evento não possui regulamento pronto' },
  { value: 'need_help', label: 'Quero saber mais sobre como criar um regulamento' },
]

const monthOptions: Array<{ value: CreateEventRequestInput['preferredMonth']; label: string }> = [
  { value: 'january', label: 'Janeiro' },
  { value: 'february', label: 'Fevereiro' },
  { value: 'march', label: 'Março' },
  { value: 'april', label: 'Abril' },
  { value: 'may', label: 'Maio' },
  { value: 'june', label: 'Junho' },
  { value: 'july', label: 'Julho' },
  { value: 'august', label: 'Agosto' },
  { value: 'september', label: 'Setembro' },
  { value: 'october', label: 'Outubro' },
  { value: 'november', label: 'Novembro' },
  { value: 'december', label: 'Dezembro' },
  { value: 'not_defined', label: 'Não tenho data definida' },
]

const initialForm: CreateEventRequestInput = {
  fullName: '',
  email: '',
  phone: '',
  company: '',
  region: '',
  sportCategory: 'road_running',
  eventsPerYear: '1',
  eventName: '',
  regulationStatus: 'ready',
  preferredMonth: 'january',
  referralName: '',
}

export function CreateEventPage() {
  const { user } = useAuth()
  const toast = useToast()
  const targetPath = user && (user.role === 'event_admin' || user.role === 'super_admin')
    ? '/gestao-eventos'
    : '/login'
  const [form, setForm] = useState<CreateEventRequestInput>(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField<Field extends keyof CreateEventRequestInput>(field: Field, value: CreateEventRequestInput[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await api.submitEventRequest(form)
      setSuccess(response.message)
      toast.success(response.message)
      setForm(initialForm)
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-shell create-event-request-page">
      <section className="content-section create-event-request-layout">
        <aside className="create-event-request-sidebar">
          <div className="panel request-sidebar-card">
            <span className="eyebrow">Como funciona</span>
            <h2>Você envia a solicitação e nossa equipe faz a liberação.</h2>
            <ul className="plain-list request-flow">
              <li>Análise comercial e operacional do organizador.</li>
              <li>Validação de modalidade, volume e momento do evento.</li>
              <li>Liberação do usuário para cadastro completo do evento.</li>
            </ul>
          </div>

          <div className="panel panel--plain request-sidebar-card">
            <span className="eyebrow">Atendimento</span>
            <h3>Precisa falar com nosso time antes do envio?</h3>
            <div className="contact-stack request-contact-list">
              <span>comercial@pacepass.local</span>
              <span>(11) 4000-2026</span>
              <span>Seg a Sex, 9h às 18h</span>
            </div>
          </div>
        </aside>

        <form className="section-surface create-event-request-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <span className="eyebrow">Formulário</span>
            <h2>Solicite a liberação do seu acesso</h2>
            <p>
              Preencha os campos abaixo. Depois da aprovação, seu usuário poderá cadastrar o evento na plataforma.
            </p>
          </div>

          {error ? <div className="error-inline">{error}</div> : null}
          {success ? <div className="success-panel">{success}</div> : null}

          <div className="form-grid">
            <label>
              <span>Nome completo*</span>
              <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
            </label>
            <label>
              <span>E-mail*</span>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
            </label>
            <label>
              <span>Telefone*</span>
              <input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
            </label>
            <label>
              <span>Empresa*</span>
              <input value={form.company} onChange={(event) => updateField('company', event.target.value)} required />
            </label>
            <label>
              <span>Região*</span>
              <select value={form.region} onChange={(event) => updateField('region', event.target.value)} required>
                <option value="">Selecione</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Qual é a modalidade esportiva do seu evento?*</span>
              <select value={form.sportCategory} onChange={(event) => updateField('sportCategory', event.target.value as CreateEventRequestInput['sportCategory'])} required>
                {sportOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quantidade de eventos organizados por ano?*</span>
              <select value={form.eventsPerYear} onChange={(event) => updateField('eventsPerYear', event.target.value as CreateEventRequestInput['eventsPerYear'])} required>
                {eventVolumeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Qual o nome do seu evento?*</span>
              <input value={form.eventName} onChange={(event) => updateField('eventName', event.target.value)} required />
            </label>
            <label>
              <span>O seu evento já possui regulamento?*</span>
              <select value={form.regulationStatus} onChange={(event) => updateField('regulationStatus', event.target.value as CreateEventRequestInput['regulationStatus'])} required>
                {regulationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Qual é o mês de realização do seu evento?*</span>
              <select value={form.preferredMonth} onChange={(event) => updateField('preferredMonth', event.target.value as CreateEventRequestInput['preferredMonth'])} required>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-span-2">
              <span>Coloque o nome em caso de indicação</span>
              <input value={form.referralName} onChange={(event) => updateField('referralName', event.target.value)} />
            </label>
          </div>

          <p className="create-event-request-form__consent">
            Ao preencher o formulário, você autoriza nosso time a entrar em contato por e-mail e telefone para analisar a solicitação e seguir com a liberação do acesso.
          </p>

          <div className="form-actions">
            <button type="submit" className="primary-button request-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Quero saber mais'}
            </button>
          </div>

          <p className="muted-note">Não atendemos dúvidas de participantes neste formulário.</p>
          <p className="muted-note">Os dados enviados ficam registrados para análise comercial e operacional.</p>
        </form>
      </section>
    </div>
  )
}