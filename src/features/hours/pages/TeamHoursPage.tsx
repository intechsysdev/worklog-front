import { useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Switch } from '@/components/ui/Field'
import { Avatar, Card, EmptyState, ErrorState, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { hoursAlertMeta } from '@/lib/labels'
import type { TeamHours, TeamHoursRow } from '@/lib/types'
import { capitalize, cn, downloadText, formatMinutes, parseDateOnly, toDateOnly, todayDateOnly } from '@/lib/utils'
import { useBranches } from '@/features/organization/api'
import { useTeamHours } from '../api'

const COLORS = { ordinary: '#AF1839', night: '#3C3C3B', extra: '#DA830B' }

const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10

function segments(row: TeamHoursRow) {
  const { breakdown } = row
  const extra = breakdown.overtimeDay + breakdown.overtimeNight
  const night = breakdown.ordinaryNight
  // Dominicales y festivos se pintan con las ordinarias: el resto del total.
  const ordinary = Math.max(0, breakdown.total - extra - night)
  return { ordinary, night, extra }
}

function weekLabel(data: TeamHours) {
  const from = parseDateOnly(data.from)
  const to = parseDateOnly(data.to)
  const month = (date: Date) => new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(date)
  const range =
    from.getMonth() === to.getMonth()
      ? `del ${from.getDate()} al ${to.getDate()} de ${month(to)}`
      : `del ${from.getDate()} de ${month(from)} al ${to.getDate()} de ${month(to)}`
  const at = new Date(data.calculatedAt)
  const atText = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
  const closed = parseDateOnly(data.to).getTime() < parseDateOnly(todayDateOnly()).getTime()
  return `Semana ${range} · cifras al ${atText}${closed ? '' : ' · provisionales'}`
}

/** Barra apilada de 0 a tope + extra semanal, con la marca del tope legal y la de "cerca del tope". */
function WeekBar({ row, data }: { row: TeamHoursRow; data: TeamHours }) {
  const max = data.weeklyCapMinutes + data.overtimeWeeklyMaxMinutes
  const { ordinary, night, extra } = segments(row)
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  const label = `Ordinarias ${formatMinutes(ordinary)}, nocturnas ${formatMinutes(night)}, extra ${formatMinutes(extra)} de un tope de ${formatMinutes(data.weeklyCapMinutes)}`

  return (
    <div className="relative h-3.5 w-full min-w-40 rounded-full bg-segmented" role="img" aria-label={label}>
      <div className="flex h-full overflow-hidden rounded-full">
        <span style={{ width: pct(ordinary), backgroundColor: COLORS.ordinary }} />
        <span style={{ width: pct(night), backgroundColor: COLORS.night }} />
        <span style={{ width: pct(extra), backgroundColor: COLORS.extra }} />
      </div>
      <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink" style={{ left: pct(data.weeklyCapMinutes) }} aria-hidden />
      <span className="absolute -top-0.5 -bottom-0.5 border-l border-dashed border-caution-dot" style={{ left: pct(data.nearCapMinutes) }} aria-hidden />
    </div>
  )
}

function exportCsv(data: TeamHours) {
  const h = (minutes: number) => String(hours(minutes)).replace('.', ',')
  const lines = [
    ['Usuario', 'Grupo', 'Ordinarias diurnas (h)', 'Ordinarias nocturnas (h)', 'Extra diurnas (h)', 'Extra nocturnas (h)', 'Dom. y fest. (h)', 'Total (h)', 'Extra autorizada (h)', 'Alerta'],
    ...data.rows.map((row) => [
      row.name,
      row.groupName ?? '',
      h(row.breakdown.ordinaryDay),
      h(row.breakdown.ordinaryNight),
      h(row.breakdown.overtimeDay),
      h(row.breakdown.overtimeNight),
      h(row.breakdown.sundayHoliday),
      h(row.breakdown.total),
      h(row.approvedOvertimeMinutes),
      row.alert === 'None' ? '' : hoursAlertMeta[row.alert].label(hours(data.weeklyCapMinutes)),
    ]),
  ]
  const csv = lines.map((line) => line.map((cell) => (/[;"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(';')).join('\r\n')
  downloadText(`horas-equipo-${data.from}-a-${data.to}.csv`, csv)
}

export default function TeamHoursPage() {
  const [date, setDate] = useState(todayDateOnly())
  const [branchId, setBranchId] = useState('')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const branches = useBranches()
  const query = useTeamHours({ date, branchId: branchId || undefined, onlyAlerts })
  const data = query.data
  const capHours = data ? hours(data.weeklyCapMinutes) : 42

  const moveWeek = (delta: number) => {
    const next = parseDateOnly(date)
    next.setDate(next.getDate() + delta * 7)
    setDate(toDateOnly(next))
  }
  const isCurrentWeek = !!data && todayDateOnly() >= data.from && todayDateOnly() <= data.to

  const columns: Column<TeamHoursRow>[] = [
    {
      key: 'name',
      header: 'Usuario',
      render: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar initials={row.initials} size="sm" tone="dark" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-ink">{row.name}</span>
            {row.groupName && <span className="truncate text-[12px] text-ink-muted">{row.groupName}</span>}
          </span>
        </span>
      ),
    },
    { key: 'bar', header: 'Semana frente al tope', wide: true, className: 'w-[34%]', render: (row) => data && <WeekBar row={row} data={data} /> },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <span className="tabular font-semibold whitespace-nowrap text-ink">{formatMinutes(row.breakdown.total)}</span>,
    },
    {
      key: 'extra',
      header: 'Extra',
      render: (row) => {
        const used = row.breakdown.overtimeDay + row.breakdown.overtimeNight
        return (
          <span className="flex flex-col">
            <span className="tabular whitespace-nowrap">
              {formatMinutes(used)} de {hours(data?.overtimeWeeklyMaxMinutes ?? 720)} h
            </span>
            {row.approvedOvertimeMinutes > 0 && (
              <span className="text-[12px] text-ink-muted">{formatMinutes(row.approvedOvertimeMinutes)} autorizadas</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'sunday',
      header: 'Dom. y fest.',
      render: (row) => <span className="tabular">{row.breakdown.sundayHoliday ? formatMinutes(row.breakdown.sundayHoliday) : '—'}</span>,
    },
    {
      key: 'alert',
      header: 'Alerta',
      render: (row) =>
        row.alert === 'None' ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <StatusChip tone={hoursAlertMeta[row.alert].tone}>{hoursAlertMeta[row.alert].label(capHours)}</StatusChip>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Horas del equipo"
        description={data ? weekLabel(data) : 'Cargando la semana…'}
        actions={
          <>
            <Switch checked={onlyAlerts} onChange={setOnlyAlerts} label="Solo con alertas" />
            <Button icon={<Download className="size-4" aria-hidden />} disabled={!data?.rows.length} onClick={() => data && exportCsv(data)}>
              Exportar
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => moveWeek(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" disabled={isCurrentWeek} onClick={() => setDate(todayDateOnly())}>
            Esta semana
          </Button>
          <Button variant="ghost" size="icon" aria-label="Semana siguiente" disabled={isCurrentWeek} onClick={() => moveWeek(1)}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {data && (
            <span className="ml-2 text-sm font-semibold text-ink">
              {capitalize(new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(parseDateOnly(data.from)).replace('.', ''))} –{' '}
              {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDateOnly(data.to)).replace('.', '')}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sede
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className={filterClass}>
            <option value="">Todas las sedes</option>
            {branches.data
              ?.filter((branch) => branch.status === 'Active')
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4" aria-label="Leyenda">
        {[
          { label: 'Ordinarias', color: COLORS.ordinary },
          { label: 'Nocturnas', color: COLORS.night },
          { label: 'Extra', color: COLORS.extra },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="size-3 rounded-[4px]" style={{ backgroundColor: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="h-4 w-0.5 rounded bg-ink" aria-hidden />
          Tope legal {capHours} h
        </span>
        {data && (
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="h-4 border-l border-dashed border-caution-dot" aria-hidden />
            Cerca del tope {hours(data.nearCapMinutes)} h
          </span>
        )}
        <span className="text-[13px] text-ink-muted min-[901px]:ml-auto">
          Extra: máximo {data ? hours(data.overtimeDailyMaxMinutes) : 2} h al día y {data ? hours(data.overtimeWeeklyMaxMinutes) : 12} h a la semana, con autorización vigente.
        </span>
      </Card>

      <DataTable
        caption="Horas del equipo en la semana"
        columns={columns}
        rows={data?.rows}
        rowKey={(row) => row.memberId}
        loading={query.isLoading}
        minWidth={900}
        className={cn(query.isPlaceholderData && 'opacity-70')}
        error={query.isError && !data ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : undefined}
        empty={
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title={onlyAlerts ? 'Nadie tiene alertas esta semana' : 'Sin horas registradas en la semana'}
            description={onlyAlerts ? 'Nadie pasó ni se acerca al tope, ni usa horas extra.' : 'Las horas aparecen cuando el equipo registra su jornada en la app.'}
            action={
              onlyAlerts ? (
                <Button size="sm" onClick={() => setOnlyAlerts(false)}>
                  Ver a todos
                </Button>
              ) : undefined
            }
          />
        }
        footer={
          data && data.rows.length > 0 ? (
            <span>
              La barra va de 0 a {hours(data.weeklyCapMinutes + data.overtimeWeeklyMaxMinutes)} h ({capHours} ordinarias +{' '}
              {hours(data.overtimeWeeklyMaxMinutes)} extra). Las cifras de la semana en curso son provisionales.
            </span>
          ) : undefined
        }
      />
    </>
  )
}
