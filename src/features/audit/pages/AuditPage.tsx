import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileClock, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput, Segmented } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { EmptyState, ErrorState, InlineMessage, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { auditOriginMeta } from '@/lib/labels'
import type { AuditEvent, AuditOrigin } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { useAuditEntityTypes, useAuditEvents, exportAudit, type AuditFilters } from '../api'
import { AuditDetail } from '../components/AuditDetail'

const PAGE_SIZE = 25
type OriginTab = 'all' | AuditOrigin

const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

const when = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace('.', '')

export default function AuditPage() {
  const [origin, setOrigin] = useState<OriginTab>('all')
  const [entityType, setEntityType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [exporting, setExporting] = useState(false)
  const debouncedSearch = useDebounced(search.trim(), 350)

  const filters: AuditFilters = {
    origin: origin === 'all' ? undefined : origin,
    entityType: entityType || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debouncedSearch || undefined,
  }
  const events = useAuditEvents({ ...filters, page, pageSize: PAGE_SIZE })
  const entityTypes = useAuditEntityTypes()
  const filtered = !!(filters.origin || filters.entityType || filters.from || filters.to || filters.search)

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }
  const clear = () => {
    setOrigin('all')
    setEntityType('')
    setFrom('')
    setTo('')
    setSearch('')
    setPage(1)
  }

  const download = async () => {
    setExporting(true)
    try {
      await exportAudit(filters)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<AuditEvent>[] = [
    { key: 'when', header: 'Fecha', render: (event) => <span className="tabular whitespace-nowrap text-ink">{when(event.occurredAt)}</span> },
    {
      key: 'who',
      header: 'Quién',
      render: (event) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{event.actorName}</span>
          {event.actorRole && <span className="text-[12px] text-ink-muted">{event.actorRole}</span>}
        </span>
      ),
    },
    {
      key: 'what',
      header: 'Qué pasó',
      wide: true,
      className: 'min-w-72',
      render: (event) => (
        <span className="flex flex-col">
          <span className="text-ink">{event.summary}</span>
          <span className="text-[12px] text-ink-muted">{event.entityType}</span>
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Origen',
      render: (event) => <StatusChip tone={auditOriginMeta[event.origin].tone} dot={false}>{auditOriginMeta[event.origin].label}</StatusChip>,
    },
  ]

  const data = events.data

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro de solo lectura: nadie puede editarlo ni borrarlo, ni siquiera un administrador."
        actions={
          <Button icon={<Download className="size-4" aria-hidden />} loading={exporting} disabled={!data?.totalCount} onClick={() => void download()}>
            Exportar
          </Button>
        }
      />

      <InlineMessage tone="info" className="max-w-3xl">
        Se registran los cambios del panel, lo que se hace en la app (también sin conexión) y los procesos automáticos.
      </InlineMessage>

      <DataTable
        caption="Eventos de auditoría"
        columns={columns}
        rows={data?.items}
        rowKey={(event) => event.id}
        loading={events.isLoading}
        minWidth={820}
        onRowClick={(event) => setDetail({ open: true, id: event.id })}
        rowLabel={(event) => `Ver detalle: ${event.summary}`}
        selectedKey={detail.open ? detail.id : null}
        error={events.isError && !data ? <ErrorState message={errorMessage(events.error)} onRetry={() => void events.refetch()} /> : undefined}
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <Segmented<OriginTab>
              ariaLabel="Origen"
              items={[
                { id: 'all', label: 'Todo' },
                { id: 'Web', label: 'Panel web' },
                { id: 'Mobile', label: 'App' },
                { id: 'System', label: 'Sistema' },
              ]}
              value={origin}
              onChange={reset(setOrigin)}
              className="self-start"
            />
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput label="Buscar en auditoría" placeholder="Buscar persona o acción" value={search} onChange={reset(setSearch)} className="basis-full sm:basis-auto sm:flex-1" />
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Entidad
                <select value={entityType} onChange={(event) => reset(setEntityType)(event.target.value)} className={filterClass}>
                  <option value="">Todas</option>
                  {entityTypes.data?.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Desde
                <input type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} className={filterClass} />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Hasta
                <input type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} className={filterClass} />
              </label>
              {filtered && (
                <Button variant="ghost" size="sm" icon={<X className="size-3.5" aria-hidden />} onClick={clear}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        }
        empty={
          <EmptyState
            icon={<FileClock className="size-5" />}
            title={filtered ? 'Ningún evento coincide' : 'Aún no hay eventos'}
            description={filtered ? 'Prueba con otras fechas o quita algún filtro.' : 'Cada cambio en WorkLog queda registrado aquí.'}
            action={
              filtered ? (
                <Button size="sm" onClick={clear}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        }
        footer={
          data && data.totalCount > 0 ? (
            <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} noun={['evento', 'eventos']} />
          ) : undefined
        }
      />

      <AuditDetail id={detail.id} open={detail.open} onClose={() => setDetail((state) => ({ ...state, open: false }))} />
    </>
  )
}
