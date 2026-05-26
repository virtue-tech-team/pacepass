import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { getHomeRoute } from '../lib/account'
import type { Role } from '../types'

function renderRoleIcon(role: Role) {
  if (role === 'super_admin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 18.5 6v5.3c0 4.2-2.5 7.6-6.5 9.2-4-1.6-6.5-5-6.5-9.2V6L12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9.2 12 1.7 1.7 4.1-4.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (role === 'event_admin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 12h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16.8 14.8h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.2a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function getRoleLabel(role: Role) {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'event_admin') return 'Administrador de evento'
  return 'Atleta'
}

export function Shell() {
  const { user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="layout">
      <header className="site-header">
        <div className="topbar">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/pacepass-logo.png" alt="PacePass" />
          </Link>

          <nav className="main-nav">
            <NavLink to="/eventos">Modalidades</NavLink>
            <NavLink to="/calendario">Calendário de Eventos</NavLink>
            <NavLink to="/atendimento">Atendimento</NavLink>
            <NavLink to="/crie-seu-evento">Crie seu evento</NavLink>
          </nav>

          <div className="auth-actions">
            {user ? (
              <>
                <div className="auth-actions__buttons">
                  <Link className="primary-button" to={getHomeRoute(user.role)}>
                    Minha área
                  </Link>
                </div>
                <div className="user-menu" ref={userMenuRef}>
                  <button
                    type="button"
                    className={`user-menu__trigger user-menu__trigger--${user.role}`}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label="Abrir menu da conta"
                    onClick={() => setIsMenuOpen((current) => !current)}
                  >
                    <span className="user-menu__avatar">{renderRoleIcon(user.role)}</span>
                  </button>

                  {isMenuOpen ? (
                    <div className="user-menu__dropdown" role="menu">
                      <div className="user-menu__summary">
                        <span className="user-menu__role">{getRoleLabel(user.role)}</span>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>

                      <div className="user-menu__items">
                        <Link className="user-menu__item" to="/minha-conta" role="menuitem" onClick={() => setIsMenuOpen(false)}>
                          Minha conta
                        </Link>
                        <button type="button" className="user-menu__item user-menu__item--danger" role="menuitem" onClick={logout}>
                          Sair
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <Link className="ghost-button" to="/login">
                  Login
                </Link>
                <Link className="primary-button" to="/cadastro">
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <Link to="/" className="site-footer__logo" aria-label="PacePass">
              <img className="brand-mark" src="/pacepass-logo.png" alt="PacePass" />
            </Link>
            <div className="site-footer__socials" aria-label="Redes sociais PacePass">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram PacePass">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
                </svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook PacePass">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13.2 20v-6h2.3l.4-3h-2.7V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.4-.1-1.2-.2-2.2-.2-2.2 0-3.7 1.3-3.7 4V11H8v3h2v6h3.2Z" fill="currentColor" />
                </svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn PacePass">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.2 8.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM4.8 9.8h2.8v9.4H4.8V9.8Zm4.7 0h2.7v1.3h.1c.4-.7 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7v5h-2.8v-4.4c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4v4.5H9.5V9.8Z" fill="currentColor" />
                </svg>
              </a>
            </div>
          </div>

          <div className="site-footer__nav">
            <div>
              <strong>Participantes</strong>
              <Link to="/login">Login</Link>
              <Link to="/cadastro">Criar conta</Link>
              <Link to="/minhas-inscricoes">Minhas inscrições</Link>
              <Link to="/atendimento">Central de ajuda</Link>
            </div>
            <div>
              <strong>Organizadores</strong>
              <Link to="/crie-seu-evento">Crie seu evento</Link>
              <Link to="/login">Acesso organizador</Link>
              <Link to="/atendimento">Suporte operacional</Link>
              <Link to="/calendario">Calendário</Link>
            </div>
            <div>
              <strong>Plataforma</strong>
              <Link to="/eventos">Explorar eventos</Link>
              <Link to="/termos-de-uso">Termos de Uso</Link>
              <Link to="/politica-de-privacidade">Política de Privacidade</Link>
              <Link to="/atendimento">Contato</Link>
            </div>
            <div>
              <strong>Empresa</strong>
              <Link to="/">Sobre a PacePass</Link>
              <Link to="/crie-seu-evento">Comercial</Link>
              <Link to="/atendimento">Fale conosco</Link>
            </div>
          </div>

          <div className="site-footer__bottom">
            <span>© {currentYear} PacePass. Plataforma de inscrições, pagamentos e operação para eventos esportivos.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}