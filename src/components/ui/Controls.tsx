import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Minus, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Control segmentado (§6: contenedor #E8E8E7, radio 12, padding 4) ─────────

export interface SegmentItem<T extends string> {
  id: T
  label: ReactNode
  badge?: ReactNode
}

/**
 * Pestañas o filtros. Con `role="tablist"` se navega con las flechas, como pide el patrón ARIA.
 * `panelId` enlaza cada pestaña con el panel que controla (si lo hay).
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  size = 'md',
  panelId,
}: {
  items: SegmentItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  size?: 'sm' | 'md'
  panelId?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + items.length) % items.length
    refs.current[next]?.focus()
    onChange(items[next]!.id)
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-[12px] bg-segmented p-1', className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex items-center gap-2 rounded-[9px] px-3.5 text-sm whitespace-nowrap transition-colors',
              size === 'md' ? 'h-9' : 'h-8 px-3 text-[13px]',
              selected
                ? 'bg-raised font-semibold text-ink shadow-[var(--shadow-soft)]'
                : 'font-medium text-ink-soft hover:text-ink',
            )}
          >
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}

// ── Chips de selección (§6: seleccionado #AF1839 con texto blanco) ───────────

export interface ChipOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

/** Selección única (radiogroup) o múltiple (botones con aria-pressed). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  ariaLabel,
  className,
  invalid,
}: {
  options: ChipOption<T>[]
  value: T | T[] | null
  onChange: (value: T) => void
  multiple?: boolean
  ariaLabel: string
  className?: string
  invalid?: boolean
}) {
  const isSelected = (option: T) => (Array.isArray(value) ? value.includes(option) : value === option)

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const selected = isSelected(option.value)
        return (
          <button
            key={option.value}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-checked={multiple ? undefined : selected}
            aria-pressed={multiple ? selected : undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-accent-solid bg-accent-solid text-white'
                : cn('bg-raised text-ink-soft hover:border-ink-subtle hover:text-ink', invalid ? 'border-critical' : 'border-line-strong'),
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Stepper − valor + ───────────────────────────────────────────────────────

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format = (current) => String(current),
  label,
  decreaseLabel,
  increaseLabel,
  disabled,
  className,
}: {
  value: number
  onChange: (value: number) => void
  step: number
  min: number
  max: number
  format?: (value: number) => ReactNode
  label: string
  decreaseLabel?: string
  increaseLabel?: string
  disabled?: boolean
  className?: string
}) {
  const labelId = useId()
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex h-10 items-stretch overflow-hidden rounded-[10px] border border-line-strong bg-raised"
      >
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          disabled={disabled || value <= min}
          aria-label={decreaseLabel ?? `Disminuir ${label.toLowerCase()}`}
          className="flex w-10 items-center justify-center bg-inset text-ink-soft transition-colors hover:bg-segmented hover:text-ink disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <output
          aria-live="polite"
          className="tabular flex min-w-20 flex-1 items-center justify-center px-2 text-[15px] font-semibold text-ink"
        >
          {format(value)}
        </output>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          disabled={disabled || value >= max}
          aria-label={increaseLabel ?? `Aumentar ${label.toLowerCase()}`}
          className="flex w-10 items-center justify-center bg-inset text-ink-soft transition-colors hover:bg-segmented hover:text-ink disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

// ── Buscador ────────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <div
      className={cn(
        'flex h-10 min-w-0 items-center gap-2 rounded-[10px] border border-line-strong bg-raised px-3 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 sm:min-w-60',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="rounded-md p-0.5 text-ink-muted hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

// ── Menú contextual ─────────────────────────────────────────────────────────

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className,
  menuClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  menuClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => containerRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus(), 30)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((value) => !value), id })}

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute z-40 min-w-56 overflow-hidden rounded-[12px] border border-line bg-overlay p-1 shadow-[var(--shadow-float)]',
              align === 'end' ? 'right-0' : 'left-0',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-1.5',
              menuClassName,
            )}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  tone = 'default',
  disabled,
  selected,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  selected?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-current={selected || undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors outline-none disabled:pointer-events-none disabled:opacity-45',
        tone === 'danger'
          ? 'text-critical hover:bg-critical-soft focus:bg-critical-soft'
          : 'text-ink-soft hover:bg-inset hover:text-ink focus:bg-inset focus:text-ink',
        selected && 'font-semibold text-ink',
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <hr className="my-1 h-px border-0 bg-line" />
}
