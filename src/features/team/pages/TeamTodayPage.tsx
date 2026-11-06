import { lazy, Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, RefreshCw, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented, SearchInput } from '@/components/ui/Controls'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Avatar, EmptyState, ErrorState, KpiCard, PageHeader, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { teamStatusMeta } from '@/lib/labels'
import type { TeamFilter, TeamMemberRow, TeamToday } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { cn, formatClock, formatLongDate, formatMinutes, formatRelative, plural } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { useBranches } from '@/features/organization/api'
import { useTeamToday } from '../api'

// El mapa (MapLibre) solo se descarga al abrir una ubicación.
const LocationsDialog = lazy(() => import('../components/LocationsDialog'))

const filters: { id: TeamFilter; label: string }[] = [
  { id: 'All', label: 'Todos' },
  { id: 'Working', label: 'Trabajando' },
  { id: 'Idle', label: 'Sin actividad' },
  { id: 'NotStarted', label: 'Sin iniciar' },
]

/** Margen antes del tope semanal en que se avisa "cerca del tope" (38 h de 42 h). */
const NEAR_CAP_MINUTES = 4 * 60
/** Batería baja: en ámbar (§1, Equipo hoy). */
const LOW_BATTERY = 15

function activityText(row: TeamMemberRow) {
  switch (row.status) {
    case 'InActivity':
    case 'Paused':
      return [row.activityName ?? 'Actividad', row.workOrderNumber].filter(Boolean).join(' · ')
    case 'Idle':
      return row.idleMinutes != null ? `— hace ${row.idleMinutes} min` : '— sin actividad'
    case 'NotStarted': {
      const shift = row.shiftStart ? `Turno desde ${formatClock(row.shiftStart)}` : 'Sin iniciar'
      return row.lateMinutes > 0 ? `${shift} · ${formatMinutes(row.lateMinutes)} tarde` : shift
    }
    case 'Absence':
      return row.planLabel ?? 'Novedad aprobada'
    case 'DayOff':
      return row.planLabel ?? 'Hoy no tiene turno'
    case 'Closed':
      return row.planLabel ? `Jornada cerrada · ${row.planLabel}` : 'Jornada cerrada'
  }
}

function geofenceText(row: TeamMemberRow) {
  const accuracy = row.accuracy != null ? ` · ${Math.round(row.accuracy)} m` : ''
  switch (row.geofence) {
    case 'Inside':
      return { text: `Dentro${accuracy}`, warn: false }
    case 'Outside':
      return { text: `Fuera${accuracy}`, warn: true }
    case 'Unknown':
      return { text: 'Precisión insuficiente', warn: false }
    case 'NoLocation':
      return { text: 'Sin ubicación', warn: true }
    default:
      return { text: '—', warn: false }
  }
}

function deviceText(row: TeamMemberRow): { text: string; warn: boolean; model?: string } {
  const model = row.deviceModel
  // Sin datos de MobiControl la persona no tiene dispositivo vinculado (p. ej. solo usa el panel).
  if (row.deviceOnline === undefined) return { text: model ? 'Sin datos de MobiControl' : 'Sin dispositivo', warn: false, model }
  if (!row.deviceOnline) {
    const seen = row.deviceLastSeenAt ?? row.lastSeenAt
    return { text: seen ? `Sin conexión ${sinceText(seen)}` : 'Sin conexión', warn: true, model }
  }
  const battery = row.batteryPercent
  if (battery != null && battery <= LOW_BATTERY) return { text: `Batería baja · ${battery}%`, warn: true, model }
  return { text: battery != null ? `En línea · ${battery}%` : 'En línea', warn: false, model }
}

/** "desde hace 40 min", "desde ayer". */
function sinceText(value: string) {
  const relative = formatRelative(value)
  return relative === 'ayer' ? 'desde ayer' : relative.startsWith('hace') ? `desde ${relative}` : `desde el ${relative}`
}

function weekCell(row: TeamMemberRow, capMinutes: number) {
  const text = formatMinutes(row.weekMinutes)
  if (row.weekMinutes >= capMinutes) return <span className="font-bold text-critical">{text} · pasó el tope</span>
  if (row.weekMinutes >= capMinutes - NEAR_CAP_MINUTES)
    return <span className="font-bold text-caution">{text} · cerca del tope</span>
  return text
}

export default function TeamTodayPage() {
  const { profile, can } = useAuth()
  const canSeeLocations = can('view_locations')
  const [locating, setLocating] = useState<{ id: string; name: string } | null>(null)
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filtro') as TeamFilter | null) ?? 'All'
  const branchId = params.get('sede') ?? undefined
  const search = params.get('q') ?? ''
  const debouncedSearch = useDebounced(search.trim(), 350)

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const branches = useBranches()
  const team = useTeamToday({ branchId, filter, search: debouncedSearch || undefined })
  const data = team.data

  const columns = useMemo<Column<TeamMemberRow>[]>(() => {
    const cap = data?.weeklyCapMinutes ?? 42 * 60
    return [
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
            {canSeeLocations && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto shrink-0"
                aria-label={`Ver ubicación de ${row.name}`}
                title="Ver ubicación"
                onClick={() => setLocating({ id: row.memberId, name: row.name })}
              >
                <MapPin className="size-4" aria-hidden />
              </Button>
            )}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        render: (row) => <StatusChip tone={teamStatusMeta[row.status].tone}>{teamStatusMeta[row.status].label}</StatusChip>,
      },
      {
        key: 'activity',
        header: 'Actividad',
        className: 'min-w-56',
        render: (row) => (
          <span className={cn('text-ink', row.status === 'NotStarted' && row.lateMinutes > 0 && 'text-caution')}>
            {activityText(row)}
          </span>
        ),
      },
      { key: 'site', header: 'Sitio', render: (row) => row.siteName ?? '—' },
      {
        key: 'since',
        header: 'Desde',
        render: (row) => <span className="tabular">{row.since ? formatClock(row.since) : '—'}</span>,
      },
      { key: 'week', header: 'Semana', render: (row) => <span className="tabular">{weekCell(row, cap)}</span> },
      {
        key: 'geofence',
        header: 'Geocerca',
        render: (row) => {
          const geo = geofenceText(row)
          return <span className={cn(geo.warn && 'font-semibold text-caution')}>{geo.text}</span>
        },
      },
      {
        key: 'device',
        header: 'Dispositivo',
        render: (row) => {
          const device = deviceText(row)
          return (
            <span className="flex flex-col">
              <span className={cn('text-[13px] whitespace-nowrap', device.warn && 'font-semibold text-caution')}>{device.text}</span>
              {device.model && <span className="text-[12px] text-ink-muted">{device.model}</span>}
            </span>
          )
        },
      },
    ]
  }, [data?.weeklyCapMinutes, canSeeLocations])

  const filtered = filter !== 'All' || !!debouncedSearch

  return (
    <>
      <PageHeader
        title="Equipo hoy"
        description={
          data ? (
            <>
              {formatLongDate(data.date)} · actualizado {formatClock(data.updatedAt)}
              {team.isFetching && <span className="sr-only"> (actualizando)</span>}
            </>
          ) : (
            'Cargando el estado del equipo…'
          )
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Sede
              <select
                value={branchId ?? ''}
                onChange={(event) => update({ sede: event.target.value || undefined })}
                className="h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
              >
                <option value="">Todas las sedes</option>
                {branches.data
                  ?.filter((branch) => branch.status !== 'Draft')
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void team.refetch()}
              aria-label="Actualizar ahora"
              title="Actualizar ahora"
            >
              <RefreshCw className={cn('size-4', team.isFetching && 'animate-spin')} aria-hidden />
            </Button>
            {profile && (
              <span className="hidden items-center gap-2 text-sm text-ink sm:inline-flex">
                <Avatar initials={profile.initials} tone="dark" />
                {profile.fullName} · {profile.roleName}
              </span>
            )}
          </>
        }
      />

      <Kpis data={data} loading={team.isLoading} />

      <DataTable
        caption="Estado del equipo hoy"
        columns={columns}
        rows={data?.rows}
        rowKey={(row) => row.memberId}
        loading={team.isLoading}
        minWidth={1000}
        error={team.isError && !data ? <ErrorState message={errorMessage(team.error)} onRetry={() => void team.refetch()} /> : undefined}
        toolbar={
          <>
            <Segmented
              ariaLabel="Filtrar por estado"
              items={filters}
              value={filter}
              onChange={(value) => update({ filtro: value === 'All' ? undefined : value })}
            />
            <SearchInput
              label="Buscar usuario u OT"
              placeholder="Buscar usuario u OT"
              value={search}
              onChange={(value) => update({ q: value || undefined })}
            />
          </>
        }
        empty={
          <EmptyState
            icon={<UsersRound className="size-5" />}
            title={filtered ? 'Nadie coincide con el filtro' : 'Aún no hay personas en el equipo'}
            description={
              filtered
                ? 'Prueba con otro estado o borra la búsqueda.'
                : 'Invita usuarios móviles y asígnales una sede para verlos aquí.'
            }
            action={
              filtered ? (
                <Button size="sm" onClick={() => update({ filtro: undefined, q: undefined })}>
                  Ver todos
                </Button>
              ) : undefined
            }
          />
        }
        footer={
          data && data.rows.length > 0 ? (
            <>
              <span>
                Mostrando {data.rows.length} de {plural(data.kpis.total, 'usuario')}
              </span>
              {filtered && (
                <Button variant="tertiary" size="sm" onClick={() => update({ filtro: undefined, q: undefined })}>
                  Ver todos
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {locating && (
        <Suspense fallback={null}>
          <LocationsDialog member={locating} onClose={() => setLocating(null)} />
        </Suspense>
      )}
    </>
  )
}

function Kpis({ data, loading }: { data?: TeamToday; loading: boolean }) {
  if (loading || !data) {
    return (
      <section className="grid grid-cols-2 gap-4 min-[901px]:grid-cols-4" aria-label="Resumen">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-[14px] border border-line bg-raised p-[18px]">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </section>
    )
  }

  const { kpis } = data
  const lateText = [
    kpis.late > 0 ? `${kpis.late} tarde` : null,
    kpis.withAbsence > 0 ? `${kpis.withAbsence} con novedad` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="grid grid-cols-2 gap-4 min-[901px]:grid-cols-4" aria-label="Resumen">
      <KpiCard label="En actividad" value={kpis.inActivity} note={`de ${plural(kpis.total, 'usuario')}`} />
      <KpiCard label="En pausa" value={kpis.paused} note={kpis.closed > 0 ? `${kpis.closed} ya ${kpis.closed === 1 ? 'cerró' : 'cerraron'} jornada` : 'pausas en curso'} />
      <KpiCard
        label="Sin actividad"
        value={kpis.idle}
        alert={kpis.idleOverThreshold > 0}
        note={
          kpis.idleOverThreshold > 0
            ? `${kpis.idleOverThreshold} ${kpis.idleOverThreshold === 1 ? 'lleva' : 'llevan'} más de ${data.inactivityAlertMinutes} min`
            : `aviso a los ${data.inactivityAlertMinutes} min`
        }
      />
      <KpiCard label="Sin iniciar jornada" value={kpis.notStarted} note={lateText || 'todos a tiempo'} />
    </section>
  )
}
