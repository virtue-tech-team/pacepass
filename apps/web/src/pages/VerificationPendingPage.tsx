import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'

export function VerificationPendingPage() {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const email = searchParams.get('email') || ''
  const [isResendingEmail, setIsResendingEmail] = useState(false)
  const [error, setError] = useState('')

  async function handleResendVerificationEmail() {
    if (!email.trim()) {
      const message = 'Não encontramos o e-mail desta conta. Volte ao cadastro e tente novamente.'
      setError(message)
      toast.error(message)
      return
    }

    setIsResendingEmail(true)
    setError('')

    try {
      const response = await api.resendVerificationEmail(email.trim())
      toast.success(response.message)
    } catch (currentError) {
      const message = (currentError as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setIsResendingEmail(false)
    }
  }

  return (
    <div className="page-shell auth-page">
      <section className="panel auth-card">
        <div className="auth-card__header">
          <span className="eyebrow">Verificação</span>
          <h1>Confirme sua conta</h1>
          <p>
            Enviamos um link de confirmação para <strong>{email || 'o e-mail informado no cadastro'}</strong>. Abra sua caixa de entrada e confirme o acesso antes do primeiro login.
          </p>
        </div>
        <div className="subpanel subpanel--soft auth-card__helper">
          <strong>Antes de continuar</strong>
          <ul className="plain-list auth-info-list">
            <li>Verifique também a caixa de spam ou promoções.</li>
            <li>Sempre use o e-mail mais recente, caso tenha pedido reenvio.</li>
            <li>Depois da confirmação, volte para o login normalmente.</li>
          </ul>
        </div>
        {error ? <div className="error-inline">{error}</div> : null}
        <div className="auth-card__actions">
          <button type="button" className="primary-button" disabled={isResendingEmail} onClick={() => void handleResendVerificationEmail()}>
            {isResendingEmail ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
          </button>
        </div>
        <div className="auth-card__links">
          <p>
            Já confirmou? <Link to="/login">Ir para o login</Link>
          </p>
          <p>
            Informou o e-mail errado? <Link to="/cadastro">Criar conta novamente</Link>
          </p>
        </div>
      </section>
    </div>
  )
}