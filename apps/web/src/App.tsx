import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'

import { AuthenticatedLayout } from './components/AuthenticatedLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Shell } from './components/Shell'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AccessRequestsPage } from './pages/AccessRequestsPage'
import { AuthLinkStatusPage } from './pages/AuthLinkStatusPage'
import { CalendarPage } from './pages/CalendarPage'
import { CreateEventPage } from './pages/CreateEventPage'
import { EventAdminPage } from './pages/EventAdminPage'
import { EventCheckoutPage } from './pages/EventCheckoutPage'
import { EventDetailsPage } from './pages/EventDetailsPage'
import { EventsManagementPage } from './pages/EventsManagementPage'
import { EventsPage } from './pages/EventsPage'
import { FinancePage } from './pages/FinancePage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyRegistrationsPage } from './pages/MyRegistrationsPage'
import { OrganizersManagementPage } from './pages/OrganizersManagementPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SupportPage } from './pages/SupportPage'
import { SupportRegistrationsPage } from './pages/SupportRegistrationsPage'
import { TermsOfUsePage } from './pages/TermsOfUsePage'
import { UserDashboardPage } from './pages/UserDashboardPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { VerificationPendingPage } from './pages/VerificationPendingPage'

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  return null
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="/e/:slug" element={<EventDetailsPage />} />
              <Route path="/checkout/:slug" element={<ProtectedRoute><EventCheckoutPage /></ProtectedRoute>} />
              <Route path="/eventos" element={<EventsPage />} />
              <Route path="/eventos/:slug" element={<EventDetailsPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/atendimento" element={<SupportPage />} />
              <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/crie-seu-evento" element={<CreateEventPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<RegisterPage />} />
              <Route path="/verificacao-conta" element={<VerificationPendingPage />} />
              <Route path="/confirmar-conta" element={<VerifyEmailPage />} />
              <Route path="/link-de-acesso" element={<AuthLinkStatusPage />} />
              <Route path="/esqueci-minha-senha" element={<ForgotPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

              <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
                <Route path="/minha-conta" element={<UserDashboardPage />} />
                <Route path="/minhas-inscricoes" element={<MyRegistrationsPage />} />
                <Route
                  path="/admin"
                  element={<ProtectedRoute roles={['super_admin']}><AdminDashboardPage /></ProtectedRoute>}
                />
                <Route
                  path="/organizadores"
                  element={<ProtectedRoute roles={['super_admin']}><OrganizersManagementPage /></ProtectedRoute>}
                />
                <Route
                  path="/eventos-cadastrados"
                  element={<ProtectedRoute roles={['super_admin', 'event_admin']}><EventsManagementPage /></ProtectedRoute>}
                />
                <Route
                  path="/solicitacoes-acesso"
                  element={<ProtectedRoute roles={['super_admin']}><AccessRequestsPage /></ProtectedRoute>}
                />
                <Route
                  path="/gestao-eventos"
                  element={<ProtectedRoute roles={['super_admin', 'event_admin']}><EventAdminPage /></ProtectedRoute>}
                />
                <Route
                  path="/gestao-eventos/:eventId/editar"
                  element={<ProtectedRoute roles={['super_admin', 'event_admin']}><EventAdminPage /></ProtectedRoute>}
                />
                <Route
                  path="/financeiro"
                  element={<ProtectedRoute roles={['super_admin', 'event_admin']}><FinancePage /></ProtectedRoute>}
                />
                <Route
                  path="/suporte-inscricoes"
                  element={<ProtectedRoute roles={['super_admin', 'event_admin']}><SupportRegistrationsPage /></ProtectedRoute>}
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App