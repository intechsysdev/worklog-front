import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

// ── Tarjeta ─────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
  padded = true,
  as: Tag = 'section',
  ...rest
}: {
  className?: string
  children: ReactNode
  padded?: boolean
  as?: 'section' | 'div' | 'aside' | 'article'
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <Tag className={cn('surface-card', padded && 'p-5', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-bold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}

// ── Chip de estado (§6: pill con punto de 8 px, 13 px, 600) ──────────────────

export type ChipTone = 'positive' | 'caution' | 'neutral' | 'accent' | 'outline' | 'critical'

const chipTones: Record<ChipTone, { box: string; dot: string }> = {
  positive: { box: 'bg-positive-soft text-positive', dot: 'bg-positive-dot' },
  caution: { box: 'bg-caution-soft text-caution', dot: 'bg-caution-dot' },
  neutral: { box: 'bg-neutral-soft text-ink-soft', dot: 'bg-neutral-dot' },
  accent: { box: 'bg-accent-soft text-accent-ink', dot: 'bg-accent' },
  outline: { box: 'border border-line-strong bg-raised text-ink-soft', dot: 'bg-line-strong' },
  critical: { box: 'bg-critical-soft text-critical', dot: 'bg-critical' },
}

export function StatusChip({
  tone = 'neutral',
  children,
  dot = true,
  className,
}: {
  tone?: ChipTone
  children: ReactNode
  dot?: boolean
  className?: string
}) {
  const style = chipTones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap',
        style.box,
        className,
      )}
    >
      {dot && <span className={cn('size-2 shrink-0 rounded-full', style.dot)} aria-hidden />}
      {children}
    </span>
  )
}

/** Etiqueta pequeña tipo "Nueva", "Fijo". */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'caution' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap',
        tone === 'accent' && 'bg-accent-soft text-accent-ink',
        tone === 'neutral' && 'bg-segmented text-ink-soft',
        tone === 'caution' && 'bg-caution-soft text-caution',
      )}
    >
      {children}
    </span>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────────────

const avatarSizes = {
  sm: 'size-7 text-[11px]',
  md: 'size-8 text-[12px]',
  lg: 'size-11 text-sm',
}

export function Avatar({
  initials,
  size = 'md',
  tone = 'accent',
  className,
}: {
  initials: string
  size?: keyof typeof avatarSizes
  tone?: 'accent' | 'dark'
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        tone === 'accent' ? 'bg-accent-solid text-white' : 'bg-ink-soft text-canvas',
        avatarSizes[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}

// ── Esqueletos ──────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-t border-divider px-5 py-4 first:border-t-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className={cn('h-4', columnIndex === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-2" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-[12px] p-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ── Estados vacío y de error ────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-segmented text-ink-muted" aria-hidden>
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-5" />}
      title="No pudimos cargar esta información"
      description={message}
      action={
        onRetry && (
          <Button size="sm" icon={<RotateCw className="size-3.5" aria-hidden />} onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    />
  )
}

// ── Mensaje en línea (§6: éxito verde, error/aviso ámbar) ────────────────────

export function InlineMessage({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'success' | 'warning' | 'info' | 'error'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-sm leading-relaxed',
        tone === 'success' && 'bg-positive-soft text-positive',
        (tone === 'warning' || tone === 'error') && 'bg-caution-soft text-caution',
        tone === 'info' && 'bg-inset text-ink-soft',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ── Cabecera de página (§6: h1 28/700, subtítulo 15 #5A5958, acción a la derecha) ──

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.01em] text-ink min-[901px]:text-[28px]">{title}</h1>
        {description && <p className="max-w-3xl text-[15px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}

// ── KPI (§6: radio 14, padding 18, cifra de 32) ─────────────────────────────

export function KpiCard({
  label,
  value,
  note,
  alert,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  alert?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-[14px] border bg-raised p-[18px]',
        alert ? 'border-caution-dot' : 'border-line',
      )}
    >
      <span className={cn('text-[13px]', alert ? 'font-semibold text-caution' : 'text-ink-muted')}>{label}</span>
      <span className="tabular text-[32px] leading-tight font-bold text-ink">{value}</span>
      {note && <span className="text-[13px] text-ink-soft">{note}</span>}
    </div>
  )
}

// ── Lista clave-valor ───────────────────────────────────────────────────────

export function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-muted">{item.label}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
