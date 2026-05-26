import type { Role } from '../types'

export function getHomeRoute(role: Role) {
  switch (role) {
    case 'super_admin':
      return '/admin'
    case 'event_admin':
      return '/gestao-eventos'
    default:
      return '/minha-conta'
  }
}