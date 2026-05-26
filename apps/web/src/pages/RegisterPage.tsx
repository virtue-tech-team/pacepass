import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    acceptedTerms: false,
    acceptedPrivacyPolicy: false,
    acceptedLgpdConsent: false,
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    if (!form.acceptedTerms || !form.acceptedPrivacyPolicy || !form.acceptedLgpdConsent) {
      const message = 'Você precisa aceitar os termos, a política de privacidade e o consentimento LGPD para criar a conta.'
      setError(message)
      toast.error(message)
      setIsSubmitting(false)
      return
    }

    try {
      const message = await register(form)
      toast.success(message)
      navigate(`/verificacao-conta?email=${encodeURIComponent(form.email.trim())}`)
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-shell auth-page">
      <form className="panel auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__header">
          <span className="eyebrow">Cadastro</span>
          <h1>Criar conta</h1>
          <p>Crie seu acesso com transparência sobre tratamento de dados, regras da plataforma e comunicações essenciais da sua conta.</p>
        </div>
        <label>
          <span>Nome</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>E-mail</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
        <label>
          <span>Telefone</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label>
          <span>Senha</span>
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </label>
        <div className="subpanel subpanel--soft auth-card__helper">
          <strong>Documentos importantes</strong>
          <ul className="plain-list auth-info-list">
            <li><Link to="/termos-de-uso">Ler os Termos de Uso</Link></li>
            <li><Link to="/politica-de-privacidade">Ler a Política de Privacidade</Link></li>
          </ul>
        </div>
        <div className="auth-consent-list">
          <label className="checkout-checkbox auth-consent-item">
            <input type="checkbox" checked={form.acceptedTerms} onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })} />
            <span>Li e aceito os <Link to="/termos-de-uso">Termos de Uso</Link> da plataforma.</span>
          </label>
          <label className="checkout-checkbox auth-consent-item">
            <input type="checkbox" checked={form.acceptedPrivacyPolicy} onChange={(event) => setForm({ ...form, acceptedPrivacyPolicy: event.target.checked })} />
            <span>Li e estou de acordo com a <Link to="/politica-de-privacidade">Política de Privacidade</Link>.</span>
          </label>
          <label className="checkout-checkbox auth-consent-item">
            <input type="checkbox" checked={form.acceptedLgpdConsent} onChange={(event) => setForm({ ...form, acceptedLgpdConsent: event.target.checked })} />
            <span>Autorizo o tratamento dos meus dados pessoais para criação da conta, autenticação, suporte e execução dos serviços, nos termos da LGPD.</span>
          </label>
        </div>
        {error ? <div className="error-inline">{error}</div> : null}
        <div className="auth-card__actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar conta'}
          </button>
        </div>
        <small>Depois do cadastro, você vai confirmar o e-mail por link antes do primeiro acesso.</small>
      </form>
    </div>
  )
}