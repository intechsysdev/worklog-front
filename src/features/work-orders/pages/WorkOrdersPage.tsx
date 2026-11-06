import { useState } from 'react'
import { toast } from 'sonner'
import { Ban, ClipboardList, Pencil, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { workOrderStatusMeta } from '@/lib/labels'
import type { WorkOrder, WorkOrderStatus } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { formatClock, formatDate } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { useCatalog } from '@/features/catalog/api'
import { useMemberOptions } from '@/features/members/api'
import { useSites } from '@/features/sites/api'
import { useCancelWorkOrder, useWorkOrders } from '../api'
import { ImportDialog } from '../components/ImportDialog'
import { WorkOrderForm } from '../components/WorkOrderForm'

const PAGE_SIZE = 20
const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

export default function WorkOrdersPage() {
  const { can } = useAuth()
  const canEdit = can('manage_settings')

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<WorkOrderStatus | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [workSiteId, setWorkSiteId] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 350)

  const orders = useWorkOrders({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    assigneeId: assigneeId || undefined,
    workSiteId: workSiteId || undefined,
  })
  const catalog = useCatalog()
  const sites = useSites(true)
  const members = useMemberOptions()
  const cancel = useCancelWorkOrder()

  const [editor, setEditor] = useState<{ open: boolean; order: WorkOrder | null }>({ open: false, order: null })
  const [importOpen, setImportOpen] = useState(false)
  const [toCancel, setToCancel] = useState<WorkOrder | null>(null)

  const filtered = !!(debouncedSearch || status || from || to || assigneeId || workSiteId)
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }
  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setFrom('')
    setTo('')
    setAssigneeId('')
    setWorkSiteId('')
    setPage(1)
  }

  const confirmCancel = async () => {
    if (!toCancel) return
    try {
      await cancel.mutateAsync(toCancel.id)
      toast.success(`OT ${toCancel.number} cancelada.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setToCancel(null)
    }
  }

  const columns: Column<WorkOrder>[] = [
    {
      key: 'number',
      header: 'Número',
      render: (order) => <span className="font-semibold whitespace-nowrap text-ink">{order.number}</span>,
    },
    { key: 'activity', header: 'Actividad', render: (order) => <span className="text-ink">{order.activityName}</span> },
    { key: 'site', header: 'Sitio', render: (order) => order.workSiteName ?? '—' },
    {
      key: 'assignee',
      header: 'Técnico',
      render: (order) => order.assigneeName ?? <span className="whitespace-nowrap text-caution">Sin asignar</span>,
    },
    {
      key: 'date',
      header: 'Programada',
      render: (order) => (
        <span className="tabular sm:whitespace-nowrap">
          {formatDate(order.scheduledDate)}
          {order.scheduledTime && ` · ${formatClock(order.scheduledTime)}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (order) => <StatusChip tone={workOrderStatusMeta[order.status].tone}>{workOrderStatusMeta[order.status].label}</StatusChip>,
    },
  ]

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Acciones</span>,
      label: 'Acciones',
      align: 'right',
      render: (order) => {
        const closed = order.status === 'Completed' || order.status === 'Cancelled'
        return (
          <span className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={closed}
              aria-label={`Editar OT ${order.number}`}
              title={closed ? 'La OT ya está cerrada' : 'Editar'}
              onClick={() => setEditor({ open: true, order })}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={closed}
              aria-label={`Cancelar OT ${order.number}`}
              title={closed ? 'La OT ya está cerrada' : 'Cancelar OT'}
              onClick={() => setToCancel(order)}
            >
              <Ban className="size-3.5" aria-hidden />
            </Button>
          </span>
        )
      },
    })
  }

  const data = orders.data
  const firstActivity = catalog.data?.activities.find((activity) => activity.isActive)?.name
  const firstSite = sites.data?.find((site) => site.isActive)?.name

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        description="Las OT que ve cada técnico en la app, por fecha. Créalas aquí o impórtalas desde un CSV."
        actions={
          canEdit && (
            <>
              <Button icon={<Upload className="size-4" aria-hidden />} onClick={() => setImportOpen(true)}>
                Importar CSV
              </Button>
              <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditor({ open: true, order: null })}>
                Nueva OT
              </Button>
            </>
          )
        }
      />

      <DataTable
        caption="Órdenes de trabajo"
        columns={columns}
        rows={data?.items}
        rowKey={(order) => order.id}
        loading={orders.isLoading}
        minWidth={900}
        error={orders.isError && !data ? <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} /> : undefined}
        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <SearchInput label="Buscar OT" placeholder="Buscar por número o notas" value={search} onChange={resetPage(setSearch)} className="basis-full sm:basis-auto sm:flex-1" />
            <select aria-label="Estado" value={status} onChange={(event) => resetPage(setStatus)(event.target.value as WorkOrderStatus | '')} className={filterClass}>
              <option value="">Todos los estados</option>
              {(Object.keys(workOrderStatusMeta) as WorkOrderStatus[]).map((value) => (
                <option key={value} value={value}>
                  {workOrderStatusMeta[value].label}
                </option>
              ))}
            </select>
            <select aria-label="Técnico" value={assigneeId} onChange={(event) => resetPage(setAssigneeId)(event.target.value)} className={filterClass}>
              <option value="">Todos los técnicos</option>
              {members.data?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
            <select aria-label="Sitio" value={workSiteId} onChange={(event) => resetPage(setWorkSiteId)(event.target.value)} className={filterClass}>
              <option value="">Todos los sitios</option>
              {sites.data?.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Desde
              <input type="date" value={from} max={to || undefined} onChange={(event) => resetPage(setFrom)(event.target.value)} className={filterClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Hasta
              <input type="date" value={to} min={from || undefined} onChange={(event) => resetPage(setTo)(event.target.value)} className={filterClass} />
            </label>
            {filtered && (
              <Button variant="ghost" size="sm" icon={<X className="size-3.5" aria-hidden />} onClick={clearFilters}>
                Limpiar
              </Button>
            )}
          </div>
        }
        empty={
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={filtered ? 'Ninguna OT coincide con los filtros' : 'Aún no hay órdenes de trabajo'}
            description={filtered ? 'Prueba con otras fechas o quita algún filtro.' : 'Crea la primera o importa varias a la vez desde un CSV.'}
            action={
              filtered ? (
                <Button size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : (
                canEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" icon={<Upload className="size-3.5" aria-hidden />} onClick={() => setImportOpen(true)}>
                      Importar CSV
                    </Button>
                    <Button size="sm" variant="primary" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setEditor({ open: true, order: null })}>
                      Nueva OT
                    </Button>
                  </div>
                )
              )
            }
          />
        }
        footer={
          data && data.totalCount > 0 ? (
            <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} noun={['OT', 'OT']} />
          ) : undefined
        }
      />

      {canEdit && (
        <>
          <WorkOrderForm
            open={editor.open}
            order={editor.order}
            activities={catalog.data?.activities ?? []}
            sites={sites.data ?? []}
            members={members.data ?? []}
            onClose={() => setEditor((state) => ({ ...state, open: false }))}
          />
          <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} sampleActivity={firstActivity} sampleSite={firstSite} />
          <ConfirmDialog
            open={!!toCancel}
            onClose={() => setToCancel(null)}
            onConfirm={() => void confirmCancel()}
            loading={cancel.isPending}
            title="¿Cancelar la orden de trabajo?"
            confirmLabel="Cancelar OT"
            cancelLabel="Volver"
            description={
              toCancel && (
                <>
                  La OT <strong>{toCancel.number}</strong> ({toCancel.activityName}) dejará de aparecer en la app del técnico. No se
                  puede deshacer.
                </>
              )
            }
          />
        </>
      )}
    </>
  )
}
