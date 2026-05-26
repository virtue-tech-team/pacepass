import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

type LoginMode = 'participant' | 'organizer'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState<LoginMode>('participant')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const redirectTo = searchParams.get('redirect') || '/minha-conta'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await login({ mode, identifier: identifier.trim(), password })
      toast.success('Login realizado com sucesso.')
      navigate(redirectTo)
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
          <h1>Login</h1>
        </div>
        <div className="auth-mode-switch" role="tablist" aria-label="Selecionar tipo de acesso">
          <button
            type="button"
            className={mode === 'participant' ? 'auth-mode-switch__button auth-mode-switch__button--active' : 'auth-mode-switch__button'}
            onClick={() => {
              setMode('participant')
              setIdentifier('')
              setError('')
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
        <label>
          <span>Senha</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" autoComplete="current-password" required />
        </label>
        {error ? <div className="error-inline">{error}</div> : null}
        <div className="auth-card__actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
        <div className="auth-card__links">
          <p>
            Esqueceu a senha? <Link to={`/esqueci-minha-senha?mode=${mode}`}>Redefinir acesso</Link>
          </p>
          {mode === 'participant' ? (
            <p>
              Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
            </p>
          ) : null}
        </div>
        <p className="muted-note auth-card__footnote">
          {mode === 'participant'
            ? 'Se você acabou de criar a conta, confirme o e-mail antes do primeiro acesso.'
            : 'O acesso de organizador é liberado pelo administrador com username e senha provisória.'}
        </p>
      </form>
    </div>
  )
}