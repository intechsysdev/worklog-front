import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Download, History, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input, Select } from '@/components/ui/Field'
import { Avatar, EmptyState, ErrorState, InlineMessage, KpiCard, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { ActivityLogRow } from '@/lib/types'
import { cn, formatClock, formatDayMonth, formatMinutes, initials, parseDateOnly, toDateOnly, todayDateOnly } from '@/lib/utils'
import { useMemberOptions } from '@/features/members/api'
import { useBranches } from '@/features/organization/api'
import { exportActivityLog, useActivityLog, type ActivityLogFilter } from '../api'
import { WorkdayDetailDialog } from '../components/WorkdayDetailDialog'
import { geofenceChip, workdayStatusChip } from '../labels'

const MAX_DAYS = 31

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toDateOnly(date)
}

const spanDays = (from: string, to: string) =>
  Math.round((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / 86_400_000) + 1

export default function ActivityLogPage() {
  const [filter, setFilter] = useState<ActivityLogFilter>({ from: daysAgo(6), to: todayDateOnly(), memberId: '', branchId: '' })
  const [selected, setSelected] = useState<ActivityLogRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const branches = useBranches()
  const members = useMemberOptions()

  const days = spanDays(filter.from, filter.to)
  const rangeError =
    filter.to < filter.from ? 'La fecha final es anterior a la inicial.' : days > MAX_DAYS ? `Consulta como máximo ${MAX_DAYS} días a la vez.` : null
  const query = useActivityLog(filter)
  const data = rangeError ? undefined : query.data

  const people = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.usage === 'Mobile' && (!filter.branchId || member.branchId === filter.branchId))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [members.data, filter.branchId],
  )

  const set = (patch: Partial<ActivityLogFilter>) => setFilter((current) => ({ ...current, ...patch }))

  const download = async () => {
    setExporting(true)
    try {
      await exportActivityLog(filter)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<ActivityLogRow>[] = [
    { key: 'date', header: 'Fecha', render: (row) => <span className="font-semibold whitespace-nowrap text-ink">{formatDayMonth(row.date)}</span> },
    {
      key: 'person',
      header: 'Persona',
      render: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar initials={initials(row.memberName)} size="sm" tone="dark" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-ink">{row.memberName}</span>
            {row.branchName && <span className="truncate text-[12px] text-ink-muted">{row.branchName}</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'workday',
      header: 'Jornada',
      render: (row) => (
        <span className="tabular whitespace-nowrap">
          {formatClock(row.startedAt)} – {row.endedAt ? formatClock(row.endedAt) : 'en curso'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const status = workdayStatusChip(row)
        return <StatusChip tone={status.tone}>{status.label}</StatusChip>
      },
    },
    { key: 'activities', header: 'Actividades', align: 'right', render: (row) => <span className="tabular">{row.activityCount}</span> },
    { key: 'worked', header: 'Trabajado', render: (row) => <span className="tabular whitespace-nowrap">{formatMinutes(row.workedMinutes)}</span> },
    {
      key: 'productive',
      header: 'Productivo',
      render: (row) => <span className="tabular whitespace-nowrap">{formatMinutes(row.productiveMinutes)}</span>,
    },
    {
      key: 'idle',
      header: 'Sin actividad',
      render: (row) => (
        <span className={cn('tabular whitespace-nowrap', row.withoutActivityMinutes >= 60 && 'font-semibold text-caution')}>
          {formatMinutes(row.withoutActivityMinutes)}
        </span>
      ),
    },
    {
      key: 'evidence',
      header: 'Evidencias',
      render: (row) =>
        row.photoCount + row.signatureCount === 0 ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <span className="flex items-center gap-3 text-sm text-ink-soft">
            {row.photoCount > 0 && (
              <span className="flex items-center gap-1" title="Fotos">
                <Camera className="size-3.5" aria-hidden />
                <span className="tabular">{row.photoCount}</span>
              </span>
            )}
            {row.signatureCount > 0 && (
              <span className="flex items-center gap-1" title="Firmas">
                <PenLine className="size-3.5" aria-hidden />
                <span className="tabular">{row.signatureCount}</span>
              </span>
            )}
          </span>
        ),
    },
    {
      key: 'geofence',
      header: 'Geocerca al iniciar',
      render: (row) => <StatusChip tone={geofenceChip[row.startGeofence].tone}>{geofenceChip[row.startGeofence].label}</StatusChip>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Registro de actividades"
        description="Jornadas y actividades de cada persona, con pausas, resultados y evidencias."
        actions={
          <Button icon={<Download className="size-4" aria-hidden />} loading={exporting} disabled={!data?.rows.length} onClick={() => void download()}>
            Exportar a Excel
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Input label="Desde" type="date" value={filter.from} max={todayDateOnly()} onChange={(event) => set({ from: event.target.value || daysAgo(6) })} wrapperClassName="w-44" />
        <Input label="Hasta" type="date" value={filter.to} max={todayDateOnly()} onChange={(event) => set({ to: event.target.value || todayDateOnly() })} wrapperClassName="w-44" />
        <Select label="Sede" value={filter.branchId} onChange={(event) => set({ branchId: event.target.value, memberId: '' })} wrapperClassName="w-56">
          <option value="">Todas las sedes</option>
          {branches.data
            ?.filter((branch) => branch.status === 'Active')
            .map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
        </Select>
        <Select label="Persona" value={filter.memberId} onChange={(event) => set({ memberId: event.target.value })} wrapperClassName="w-64">
          <option value="">Todas las personas</option>
          {people.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </Select>
        <div className="flex gap-1 pb-0.5">
          <Button variant="ghost" size="sm" onClick={() => set({ from: todayDateOnly(), to: todayDateOnly() })}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => set({ from: daysAgo(6), to: todayDateOnly() })}>
            7 días
          </Button>
          <Button variant="ghost" size="sm" onClick={() => set({ from: daysAgo(29), to: todayDateOnly() })}>
            30 días
          </Button>
        </div>
      </div>

      {rangeError && <InlineMessage tone="error">{rangeError}</InlineMessage>}

      {data && (
        <div className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-5">
          <KpiCard label="Jornadas" value={data.totals.workdays} />
          <KpiCard label="Personas" value={data.totals.people} />
          <KpiCard label="Actividades" value={data.totals.activities} />
          <KpiCard label="Trabajado" value={formatMinutes(data.totals.workedMinutes)} />
          <KpiCard label="Productivo" value={formatMinutes(data.totals.productiveMinutes)} />
        </div>
      )}

      <DataTable
        caption="Registro de actividades"
        columns={columns}
        rows={rangeError ? [] : data?.rows}
        rowKey={(row) => row.workdayId}
        rowLabel={(row) => `Ver la jornada de ${row.memberName} del ${formatDayMonth(row.date)}`}
        onRowClick={setSelected}
        selectedKey={selected?.workdayId ?? null}
        loading={!rangeError && query.isLoading}
        minWidth={1100}
        className={cn(query.isPlaceholderData && 'opacity-70')}
        error={!rangeError && query.isError && !data ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : undefined}
        empty={
          <EmptyState
            icon={<History className="size-5" />}
            title="Sin jornadas en el rango"
            description="Aparecen cuando las personas registran su jornada en la app. Prueba con otras fechas, sede o persona."
          />
        }
        footer={data && data.rows.length > 0 ? <span>Toca una jornada para ver sus actividades, pausas, resultados y evidencias.</span> : undefined}
      />

      <WorkdayDetailDialog row={selected} onClose={() => setSelected(null)} />
    </>
  )
}
