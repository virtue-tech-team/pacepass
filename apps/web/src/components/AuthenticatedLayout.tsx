import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

interface SidebarItem {
  label: string
  to?: string
  roles: Role[]
  disabled?: boolean
  icon: 'home' | 'event' | 'ticket' | 'money' | 'approval' | 'group'
}

const sidebarSections: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: 'Operação',
    items: [
      {
        label: 'Minha conta',
        to: '/minha-conta',
        roles: ['customer', 'event_admin', 'super_admin'],
        icon: 'home',
      },
      {
        label: 'Cadastro de eventos',
        to: '/gestao-eventos',
        roles: ['event_admin', 'super_admin'],
        icon: 'event',
      },
      {
        label: 'Gestão de organizadores',
        to: '/organizadores',
        roles: ['super_admin'],
        icon: 'group',
      },
      {
        label: 'Eventos cadastrados',
        to: '/eventos-cadastrados',
        roles: ['event_admin', 'super_admin'],
        icon: 'event',
      },
      {
        label: 'Minhas inscrições',
        to: '/minhas-inscricoes',
        roles: ['customer'],
        icon: 'ticket',
      },
      {
        label: 'Financeiro',
        to: '/financeiro',
        roles: ['event_admin', 'super_admin'],
        icon: 'money',
      },
      {
        label: 'Suporte inscrições',
        to: '/suporte-inscricoes',
        roles: ['event_admin', 'super_admin'],
        icon: 'ticket',
      },
      {
        label: 'Solicitações de acesso',
        to: '/solicitacoes-acesso',
        roles: ['super_admin'],
        icon: 'approval',
      },
    ],
  },
]

function SidebarIcon({ icon }: { icon: SidebarItem['icon'] }) {
  switch (icon) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="currentColor" />
        </svg>
      )
    case 'event':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v2H5a2 2 0 0 0-2 2v2h18V7a2 2 0 0 0-2-2h-2V3h-2v2H9V3zm14 8H3v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zm-5 3v2h-2v-2zm-4 0v2h-2v-2z" fill="currentColor" />
        </svg>
      )
    case 'ticket':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zm8-1h-1v3h1zm0 5h-1v2h1zm0 4h-1v3h1z" fill="currentColor" />
        </svg>
      )
    case 'money':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm9 3.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6M6 8v1a2 2 0 0 1-2 2h1v2H4a2 2 0 0 1 2 2v1h1v-8zm12 0h-1v8h1v-1a2 2 0 0 1 2-2h-1v-2h1a2 2 0 0 1-2-2z" fill="currentColor" />
        </svg>
      )
    case 'approval':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 3 7v6c0 4.6 3.1 8.9 9 9 5.9-.1 9-4.4 9-9V7zm4 8-4.9 4.9L8 11.8l1.4-1.4 1.7 1.7 3.5-3.5z" fill="currentColor" />
        </svg>
      )
    case 'group':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 11a3 3 0 1 0-2.9-3.8A4 4 0 0 1 14 9c.8.5 1.5 1.2 2 2m-8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2c-2.7 0-6 1.3-6 4v2h12v-2c0-2.7-3.3-4-6-4m9.5.2A5.6 5.6 0 0 1 20 18v2h2v-2c0-1.8-1.2-3.1-3.5-3.8" fill="currentColor" />
        </svg>
      )
  }
}

export function AuthenticatedLayout() {
  const { user } = useAuth()

  if (!user) {
    return <Outlet />
  }

  const visibleSections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <nav className="account-sidebar__nav" aria-label="Navegação da área autenticada">
          {visibleSections.map((section) => (
            <div key={section.title} className="account-sidebar__group">
              <strong>{section.title}</strong>
              <div className="account-sidebar__items">
                {section.items.map((item) =>
                  item.disabled ? (
                    <div key={item.label} className="account-sidebar__item account-sidebar__item--disabled">
                      <span className="account-sidebar__icon">
                        <SidebarIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ) : (
                    <NavLink
                      key={item.label}
                      to={item.to!}
                      className={({ isActive }) =>
                        `account-sidebar__item${isActive ? ' account-sidebar__item--active' : ''}`
                      }
                    >
                      <span className="account-sidebar__icon">
                        <SidebarIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="account-content">
        <Outlet />
      </div>
    </div>
  )
}