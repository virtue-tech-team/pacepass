import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

export function ProtectedRoute({ roles, children }: { roles?: Role[]; children?: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="page-shell">Carregando sessão...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/minha-conta" replace />
  }

  if (children) {
    return <>{children}</>
  }

  return <Outlet />
}