import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useToast } from '../contexts/ToastContext'
import { ApiError, api } from '../lib/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/link-de-acesso?type=reset&reason=invalid', { replace: true })
    }
  }, [navigate, token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    if (password !== confirmPassword) {
      const message = 'As senhas informadas precisam ser iguais.'
      setError(message)
      toast.error(message)
      return
    }

    if (password.length < 6) {
      const message = 'A nova senha precisa ter pelo menos 6 caracteres.'
      setError(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await api.resetPassword(token, password)
      toast.success(response.message)
      navigate('/login')
    } catch (currentError) {
      if (currentError instanceof ApiError) {
        if (currentError.code === 'EXPIRED_PASSWORD_RESET_LINK') {
          navigate('/link-de-acesso?type=reset&reason=expired', { replace: true })
          return
        }

        if (currentError.code === 'INVALID_PASSWORD_RESET_LINK') {
          navigate('/link-de-acesso?type=reset&reason=invalid', { replace: true })
          return
        }
      }

      const message = (currentError as Error).message
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
          <span className="eyebrow">Acesso</span>
          <h1>Definir nova senha</h1>
          <p>Cadastre uma nova senha para concluir a recuperação da conta.</p>
        </div>
        <label>
          <span>Nova senha</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete="new-password" required minLength={6} />
        </label>
        <label>
          <span>Confirmar nova senha</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" required minLength={6} />
        </label>
        {error ? <div className="error-inline">{error}</div> : null}
        <div className="subpanel subpanel--soft auth-card__helper">
          <strong>Dicas para a nova senha</strong>
          <ul className="plain-list auth-info-list">
            <li>Use pelo menos 6 caracteres.</li>
            <li>Evite repetir a senha antiga.</li>
            <li>Guarde essa senha para o próximo acesso.</li>
          </ul>
        </div>
        <div className="auth-card__actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </div>
        <div className="auth-card__links">
          <p>
            Já resolveu? <Link to="/login">Voltar para o login</Link>
          </p>
          <p>
            Link expirou? <Link to="/esqueci-minha-senha">Solicitar novo link</Link>
          </p>
        </div>
      </form>
    </div>
  )
}