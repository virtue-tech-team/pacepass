import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

export function ProtectedRoute({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="page-shell">Carregando sessão...</div>
  }

  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}`

    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/minha-conta" replace />
  }

  if (children) {
    return <>{children}</>
  }

  return <Outlet />
}