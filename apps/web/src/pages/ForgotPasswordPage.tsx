import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const initialMode = searchParams.get('mode') === 'organizer' ? 'organizer' : 'participant'
  const [mode, setMode] = useState<'participant' | 'organizer'>(initialMode)
  const [identifier, setIdentifier] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await api.forgotPassword({ mode, identifier: identifier.trim() })
      setMessage(response.message)
      toast.success(response.message)
    } catch (currentError) {
      const currentMessage = (currentError as Error).message
      setError(currentMessage)
      toast.error(currentMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-shell auth-page">
      <form className="panel auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__header">
          <span className="eyebrow">Acesso</span>
          <h1>Recuperar senha</h1>
          <p>
            {mode === 'participant'
              ? 'Informe seu e-mail e enviaremos um link para definir uma nova senha com segurança.'
              : 'Informe seu username. Se a conta de organizador tiver um e-mail cadastrado, enviaremos o link de redefinição para esse e-mail.'}
          </p>
        </div>
        <div className="auth-mode-switch" role="tablist" aria-label="Selecionar tipo de recuperação de acesso">
          <button
            type="button"
            className={mode === 'participant' ? 'auth-mode-switch__button auth-mode-switch__button--active' : 'auth-mode-switch__button'}
            onClick={() => {
              setMode('participant')
              setIdentifier('')
              setError('')
              setMessage('')
            }}
          >
            Sou participante
          </button>
          <button
            type="button"
            className={mode === 'organizer' ? 'auth-mode-switch__button auth-mode-switch__button--active' : 'auth-mode-switch__button'}
            onClick={() => {
              setMode('organizer')
              setIdentifier('')
              setError('')
              setMessage('')
            }}
          >
            Sou organizador
          </button>
        </div>
        <label>
          <span>{mode === 'participant' ? 'E-mail' : 'Username'}</span>
          <input
            type={mode === 'participant' ? 'email' : 'text'}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={mode === 'participant' ? 'voce@exemplo.com' : 'seu.username'}
            autoComplete="username"
            required
          />
        </label>
        {error ? <div className="error-inline">{error}</div> : null}
        {message ? <div className="panel success-panel">{message}</div> : null}
        <div className="auth-card__actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </div>
        <p className="muted-note auth-card__footnote">
          {mode === 'participant'
            ? 'Se existir uma conta com esse e-mail, você receberá as instruções em instantes.'
            : 'Se existir uma conta com esse username e houver um e-mail cadastrado nela, você receberá as instruções em instantes.'}
        </p>
        <div className="auth-card__links">
          <p>
            Lembrou a senha? <Link to="/login">Voltar para o login</Link>
          </p>
        </div>
      </form>
    </div>
  )
}