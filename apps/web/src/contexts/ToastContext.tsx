import { createContext, useContext, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastRecord {
  id: number
  title?: string
  message: string
  variant: ToastVariant
}

interface ShowToastInput {
  title?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastContextValue {
  showToast: (input: ShowToastInput) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextToastId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function showToast({ title, message, variant = 'info', durationMs = 4200 }: ShowToastInput) {
    const id = nextToastId
    nextToastId += 1

    setToasts((current) => [...current, { id, title, message, variant }])

    window.setTimeout(() => {
      dismissToast(id)
    }, durationMs)
  }

  function success(message: string, title = 'Sucesso') {
    showToast({ message, title, variant: 'success' })
  }

  function error(message: string, title = 'Erro') {
    showToast({ message, title, variant: 'error' })
  }

  function info(message: string, title = 'Aviso') {
    showToast({ message, title, variant: 'info' })
  }

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, dismissToast }}>
      {children}

      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`} role="status">
            <div className="toast__body">
              {toast.title ? <strong>{toast.title}</strong> : null}
              <span>{toast.message}</span>
            </div>
            <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Fechar notificação">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider.')
  }

  return context
}