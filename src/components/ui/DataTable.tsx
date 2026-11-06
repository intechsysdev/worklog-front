import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { TableSkeleton } from './Primitives'
import { cn, formatNumber } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Texto de la etiqueta en móvil (≤640 px). Por defecto, el header si es texto. */
  label?: string
  className?: string
  align?: 'left' | 'right' | 'center'
  /** En móvil ocupa las dos columnas de la tarjeta. */
  wide?: boolean
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  error?: ReactNode
  onRowClick?: (row: T) => void
  /** Etiqueta accesible para la acción de la fila ("Editar Laura Gómez"). */
  rowLabel?: (row: T) => string
  selectedKey?: string | null
  caption?: string
  minWidth?: number
  footer?: ReactNode
  toolbar?: ReactNode
  className?: string
}

const alignment = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

/**
 * Tabla del panel (§6): encabezado en mayúsculas de 12 px, filas con borde #EFEFEE, fila
 * seleccionada en #FBF7F8 con marcador de 3 px. En ≤640 px cada fila se vuelve una tarjeta
 * de dos columnas con etiquetas (clase .rtable en index.css).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  error,
  onRowClick,
  rowLabel,
  selectedKey,
  caption,
  minWidth = 760,
  footer,
  toolbar,
  className,
}: DataTableProps<T>) {
  let body: ReactNode

  if (error) {
    body = error
  } else if (loading && !rows) {
    body = <TableSkeleton columns={Math.min(columns.length, 6)} />
  } else if (!rows?.length) {
    body = empty
  } else {
    body = (
      <div className="overflow-x-auto">
        <table className="rtable w-full border-collapse text-sm" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'py-3 text-[12px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase',
                    index === 0 ? 'px-5' : 'px-3',
                    index === columns.length - 1 && 'pr-5',
                    alignment[column.align ?? 'left'],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row)
              const selected = selectedKey === key
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-t border-divider transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-inset',
                    selected && 'bg-selected shadow-[inset_3px_0_0_var(--accent-solid)]',
                  )}
                >
                  {columns.map((column, index) => {
                    const label = column.label ?? (typeof column.header === 'string' ? column.header : undefined)
                    const content = column.render(row)
                    return (
                      <td
                        key={column.key}
                        data-label={index === 0 ? undefined : label}
                        data-wide={column.wide || undefined}
                        className={cn(
                          'py-3.5 align-middle text-ink-soft',
                          index === 0 ? 'px-5' : 'px-3',
                          index === columns.length - 1 && 'pr-5',
                          alignment[column.align ?? 'left'],
                          column.className,
                        )}
                      >
                        {index === 0 && onRowClick ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onRowClick(row)
                            }}
                            aria-label={rowLabel?.(row)}
                            aria-pressed={selectedKey !== undefined ? selected : undefined}
                            className="w-full rounded-md text-left outline-offset-4"
                          >
                            {content}
                          </button>
                        ) : (
                          content
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className={cn('surface-card flex min-w-0 flex-col overflow-hidden', className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">{toolbar}</div>
      )}
      {body}
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-muted">
          {footer}
        </div>
      )}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  noun = ['registro', 'registros'],
}: {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  /** [singular, plural]. */
  noun?: [string, string]
}) {
  if (totalCount === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <>
      <span className="tabular">
        Mostrando {formatNumber(from)}–{formatNumber(to)} de {formatNumber(totalCount)} {totalCount === 1 ? noun[0] : noun[1]}
      </span>
      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronLeft className="size-4" aria-hidden />}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="tabular px-1.5" aria-current="page">
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      )}
    </>
  )
}
