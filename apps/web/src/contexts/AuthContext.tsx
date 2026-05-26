import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api } from '../lib/api'
import type { UpdateMyProfileInput, User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (input: { mode: 'participant' | 'organizer'; identifier: string; password: string }) => Promise<void>
  register: (input: {
    name: string
    email: string
    password: string
    phone: string
    acceptedTerms: boolean
    acceptedPrivacyPolicy: boolean
    acceptedLgpdConsent: boolean
  }) => Promise<string>
  verifyEmailToken: (token: string) => Promise<string>
  updateProfile: (input: UpdateMyProfileInput) => Promise<string>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const STORAGE_KEY = 'ticketflow-auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      setIsLoading(false)
      return
    }

    const stored = JSON.parse(raw) as { token: string }
    setToken(stored.token)

    api.me(stored.token)
      .then(({ user: currentUser }) => {
        setUser(currentUser)
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      async login(input) {
        const response = await api.login(input)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: response.token }))
        setToken(response.token)
        setUser(response.user)
      },
      async register(input) {
        const response = await api.register(input)
        return response.message
      },
      async verifyEmailToken(verificationToken) {
        const response = await api.verifyEmail(verificationToken)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: response.token }))
        setToken(response.token)
        setUser(response.user)
        return response.message
      },
      async updateProfile(input) {
        if (!token) {
          throw new Error('Sessão inválida ou expirada.')
        }

        const response = await api.updateMyProfile(token, input)
        setUser(response.user)
        return response.message
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setUser(null)
      },
    }),
    [isLoading, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}