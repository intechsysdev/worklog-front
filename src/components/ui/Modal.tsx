import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento común de los diálogos: Escape cierra, el foco entra al abrir, queda atrapado
 * dentro mientras está abierto y vuelve al elemento que lo abrió al cerrar.
 */
function useDialogBehavior(open: boolean, onClose: () => void, locked: boolean | undefined, panelRef: RefObject<HTMLDivElement | null>) {
  const onCloseRef = useRef(onClose)
  const lockedRef = useRef(locked)

  useEffect(() => {
    onCloseRef.current = onClose
    lockedRef.current = locked
  })

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lockedRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select') ??
        panelRef.current?.querySelector<HTMLElement>('button:not([data-close])')
      target?.focus()
    }, 60)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timer)
      previouslyFocused?.focus?.()
    }
  }, [open, panelRef])
}

const widths = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: keyof typeof widths
  /** Impide cerrar con Escape o clic fuera mientras hay una operación en curso. */
  locked?: boolean
}

export function Modal({ open, onClose, title, description, children, footer, width = 'md', locked }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useDialogBehavior(open, onClose, locked, panelRef)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-[var(--overlay-backdrop)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !locked && onClose()}
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              'relative my-auto w-full rounded-[16px] border border-line bg-overlay shadow-[var(--shadow-float)]',
              widths[width],
            )}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-bold text-ink">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                data-close
                onClick={onClose}
                disabled={locked}
                aria-label="Cerrar"
                className="-mt-0.5 -mr-1.5 rounded-[10px] p-2 text-ink-muted transition-colors hover:bg-segmented hover:text-ink disabled:opacity-40"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 rounded-b-[16px] border-t border-line bg-inset px-6 py-3.5">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  locked?: boolean
}

/** Panel lateral de edición (360–420 px). En móvil ocupa todo el ancho. */
export function Drawer({ open, onClose, title, eyebrow, description, children, footer, locked }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehavior(open, onClose, locked, panelRef)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            className="fixed inset-0 bg-[var(--overlay-backdrop)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !locked && onClose()}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full max-w-[420px] flex-col border-l border-line bg-overlay shadow-[var(--shadow-float)]"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div className="min-w-0">
                {eyebrow && <div className="section-label mb-1.5">{eyebrow}</div>}
                <h2 id={titleId} className="text-xl font-bold text-ink">
                  {title}
                </h2>
                {description && <div className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</div>}
              </div>
              <button
                type="button"
                data-close
                onClick={onClose}
                disabled={locked}
                aria-label="Cerrar panel"
                className="-mt-0.5 -mr-2 rounded-[10px] p-2 text-ink-muted transition-colors hover:bg-segmented hover:text-ink disabled:opacity-40"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-inset px-6 py-4">{footer}</footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      locked={loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            data-autofocus
            className={tone === 'danger' ? 'bg-critical hover:bg-critical/90 dark:text-canvas' : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
            tone === 'danger' ? 'bg-critical-soft text-critical' : 'bg-accent-soft text-accent',
          )}
        >
          <AlertTriangle className="size-4.5" aria-hidden />
        </div>
        <div className="pt-1 text-sm leading-relaxed text-ink-soft">{description}</div>
      </div>
    </Modal>
  )
}
