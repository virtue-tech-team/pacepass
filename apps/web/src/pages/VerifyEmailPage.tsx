import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { ApiError } from '../lib/api'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmailToken } = useAuth()
  const toast = useToast()
  const hasStartedVerification = useRef(false)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Validando seu link de confirmacao...')

  useEffect(() => {
    if (hasStartedVerification.current) {
      return
    }

    const token = searchParams.get('token')

    if (!token) {
      navigate('/link-de-acesso?type=verification&reason=invalid', { replace: true })
      return
    }

    hasStartedVerification.current = true

    verifyEmailToken(token)
      .then((successMessage) => {
        setStatus('success')
        setMessage(`${successMessage} Voce sera redirecionado em instantes.`)
        toast.success(successMessage)
        window.setTimeout(() => {
          navigate('/minha-conta')
        }, 1800)
      })
      .catch((currentError: Error) => {
        if (currentError instanceof ApiError) {
          if (currentError.code === 'EXPIRED_VERIFICATION_LINK') {
            navigate('/link-de-acesso?type=verification&reason=expired', { replace: true })
            return
          }

          if (currentError.code === 'INVALID_VERIFICATION_LINK') {
            navigate('/link-de-acesso?type=verification&reason=invalid', { replace: true })
            return
          }
        }

        setStatus('error')
        setMessage(currentError.message)
        toast.error(currentError.message)
      })
  }, [navigate, searchParams, toast, verifyEmailToken])

  return (
    <div className="page-shell auth-page">
      <section className="panel auth-card">
        <span className="eyebrow">Conta</span>
        <h1>{status === 'loading' ? 'Confirmando e-mail' : status === 'success' ? 'E-mail confirmado' : 'Nao foi possivel confirmar'}</h1>
        <p>{message}</p>
      </section>
    </div>
  )
}