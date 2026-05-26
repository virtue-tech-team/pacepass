import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export function ModalDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
  children,
  tone = 'default',
  isSubmitting = false,
  isConfirmDisabled = false,
}: {
  isOpen: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
  children?: React.ReactNode
  tone?: 'default' | 'danger'
  isSubmitting?: boolean
  isConfirmDisabled?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isSubmitting, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className="modal-dialog__backdrop" role="presentation" onClick={() => !isSubmitting && onClose()}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
            Fechar
          </button>
        </div>

        {children ? <div className="modal-dialog__body">{children}</div> : null}

        <div className="modal-dialog__footer">
          <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'primary-button modal-dialog__confirm modal-dialog__confirm--danger' : 'primary-button modal-dialog__confirm'}
            onClick={onConfirm}
            disabled={isSubmitting || isConfirmDisabled}
          >
            {isSubmitting ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}