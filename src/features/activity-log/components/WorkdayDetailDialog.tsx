import { lazy, Suspense, useState } from 'react'
import { Camera, Clock, ImageOff, MapPin, PenLine, Route } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, InlineMessage, KeyValueList, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { timeClassLabel } from '@/lib/labels'
import type { ActivityDetail, ActivityLogRow, EvidenceItem, Segment, WorkdayDetail } from '@/lib/types'
import { cn, formatClock, formatLongDate, formatMinutes } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { useEvidenceUrl, useWorkdayDetail } from '../api'
import { geofenceChip, workdayStatusChip } from '../labels'

const LocationsDialog = lazy(() => import('@/features/team/components/LocationsDialog'))

const range = (start: string, end?: string | null) => `${formatClock(start)} – ${end ? formatClock(end) : 'en curso'}`

/** Barra del día: cada tramo ocupa su proporción del tiempo y lleva el color de su categoría. */
function DayBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(1, segment.minutes), 0)
  if (segments.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-segmented" role="img" aria-label="Barra del día por actividad">
        {segments.map((segment, index) => (
          <span
            key={index}
            title={`${segment.title} · ${range(segment.start, segment.end)} · ${formatMinutes(segment.minutes)}`}
            style={{ width: `${(Math.max(1, segment.minutes) / total) * 100}%`, backgroundColor: segment.color }}
            className={cn(segment.kind === 'Idle' && 'opacity-60')}
          />
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-ink-muted tabular">
        <span>{formatClock(segments[0].start)}</span>
        <span>{segments.at(-1)?.end ? formatClock(segments.at(-1)!.end) : 'ahora'}</span>
      </div>
    </div>
  )
}

function EvidenceThumb({ item, onOpen }: { item: EvidenceItem; onOpen: (item: EvidenceItem) => void }) {
  const { url, isLoading, isError } = useEvidenceUrl(item.id)
  const label = item.kind === 'Signature' ? 'Firma' : 'Foto'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="relative flex size-20 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-inset focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label={`${label} de las ${formatClock(item.capturedAt)}`}
    >
      {isLoading ? (
        <Skeleton className="size-full" />
      ) : isError || !url ? (
        <ImageOff className="size-5 text-ink-muted" aria-hidden />
      ) : (
        <img src={url} alt="" className={cn('size-full', item.kind === 'Signature' ? 'bg-white object-contain' : 'object-cover')} />
      )}
      <span className="absolute bottom-0 left-0 rounded-tr-[6px] bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{label}</span>
    </button>
  )
}

function EvidenceViewer({ item, onClose }: { item: EvidenceItem | null; onClose: () => void }) {
  const { url, isError } = useEvidenceUrl(item?.id ?? null)
  return (
    <Modal open={!!item} onClose={onClose} width="lg" title={item?.kind === 'Signature' ? 'Firma del cliente' : 'Foto de la actividad'}>
      {isError ? (
        <EmptyState icon={<ImageOff className="size-5" />} title="No se pudo abrir el archivo" description="Puede que ya no esté disponible." />
      ) : url ? (
        <img src={url} alt="" className="max-h-[70vh] w-full rounded-[12px] bg-white object-contain" />
      ) : (
        <Skeleton className="h-80 rounded-[12px]" />
      )}
    </Modal>
  )
}

function ActivityCard({ activity, evidence, onOpen }: { activity: ActivityDetail; evidence: EvidenceItem[]; onOpen: (item: EvidenceItem) => void }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-[12px] border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: activity.color }} aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{activity.name}</p>
            <p className="text-[13px] text-ink-muted">
              {activity.categoryName} · {timeClassLabel[activity.timeClass]}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-ink-soft tabular">
          <Clock className="size-3.5" aria-hidden />
          {range(activity.startedAt, activity.endedAt)} · {formatMinutes(activity.minutes)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {activity.running && <StatusChip tone="accent">En curso</StatusChip>}
        {activity.outcomeLabel && (
          <StatusChip tone={activity.outcome === 'Completed' ? 'positive' : 'caution'}>{activity.outcomeLabel}</StatusChip>
        )}
        {activity.autoFinished && <StatusChip tone="neutral">Cerrada automáticamente</StatusChip>}
        {activity.startGeofence !== 'NotApplicable' && (
          <StatusChip tone={geofenceChip[activity.startGeofence].tone}>Al iniciar: {geofenceChip[activity.startGeofence].label.toLowerCase()}</StatusChip>
        )}
        {activity.endedAt && activity.endGeofence !== 'NotApplicable' && (
          <StatusChip tone={geofenceChip[activity.endGeofence].tone}>Al cerrar: {geofenceChip[activity.endGeofence].label.toLowerCase()}</StatusChip>
        )}
      </div>

      {(activity.workOrderNumber || activity.workSiteName) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {activity.workOrderNumber && <span>OT {activity.workOrderNumber}</span>}
          {activity.workSiteName && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {activity.workSiteName}
            </span>
          )}
        </p>
      )}

      {activity.pauses.length > 0 && (
        <p className="text-[13px] text-ink-muted">
          Pausas ({formatMinutes(activity.pausedMinutes)}): {activity.pauses.map((pause) => range(pause.startedAt, pause.endedAt)).join(' · ')}
        </p>
      )}

      {activity.observation && <p className="rounded-[10px] bg-inset px-3 py-2 text-sm text-ink">{activity.observation}</p>}

      {evidence.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Evidencias">
          {evidence.map((item) => (
            <EvidenceThumb key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
      {evidence.length === 0 && (activity.photoCount > 0 || activity.hasSignature) && (
        <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          {activity.photoCount > 0 && <Camera className="size-3.5" aria-hidden />}
          {activity.hasSignature && <PenLine className="size-3.5" aria-hidden />}
          Las evidencias todavía se están sincronizando desde el teléfono.
        </p>
      )}
    </li>
  )
}

function Detail({ data }: { data: WorkdayDetail }) {
  const { can } = useAuth()
  const [viewing, setViewing] = useState<EvidenceItem | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const w = data.workday
  const status = workdayStatusChip(w)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
        {w.wasAdjusted && <StatusChip tone="outline">Ajustada por solicitud</StatusChip>}
        {w.lateMinutes > 0 && <StatusChip tone="caution">Llegó {formatMinutes(w.lateMinutes)} tarde</StatusChip>}
        {can('view_locations') && (
          <Button size="sm" className="ml-auto" icon={<Route className="size-3.5" aria-hidden />} onClick={() => setMapOpen(true)}>
            Ver recorrido
          </Button>
        )}
      </div>

      <KeyValueList
        items={[
          { label: 'Turno', value: data.scheduledStart ? `${data.scheduledStart.slice(0, 5)} – ${data.scheduledEnd?.slice(0, 5) ?? ''}` : 'Sin turno' },
          {
            label: 'Inicio',
            value: (
              <span>
                {formatClock(w.startedAt)}
                {data.startSiteName && ` · ${data.startSiteName}`} · {geofenceChip[w.startGeofence].label.toLowerCase()}
              </span>
            ),
          },
          {
            label: 'Cierre',
            value: w.endedAt
              ? `${formatClock(w.endedAt)}${w.closeKind === 'Automatic' ? ' (automático)' : ''} · ${geofenceChip[w.endGeofence].label.toLowerCase()}`
              : 'Jornada abierta',
          },
          {
            label: 'Tiempo',
            value: `${formatMinutes(w.workedMinutes)} trabajado · ${formatMinutes(w.productiveMinutes)} productivo · ${formatMinutes(w.withoutActivityMinutes)} sin actividad`,
          },
        ]}
      />

      <DayBar segments={data.segments} />

      {data.note && <InlineMessage tone="info">Nota del día: {data.note}</InlineMessage>}

      {data.activities.length === 0 ? (
        <EmptyState icon={<Clock className="size-5" />} title="Sin actividades" description="La persona abrió la jornada pero no registró actividades." />
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Actividades del día">
          {data.activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              evidence={data.evidence.filter((item) => item.activityRecordId === activity.id)}
              onOpen={setViewing}
            />
          ))}
        </ol>
      )}

      <EvidenceViewer item={viewing} onClose={() => setViewing(null)} />
      {mapOpen && (
        <Suspense fallback={null}>
          <LocationsDialog member={{ id: w.memberId, name: w.memberName }} initialDate={w.date} onClose={() => setMapOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export function WorkdayDetailDialog({ row, onClose }: { row: ActivityLogRow | null; onClose: () => void }) {
  const detail = useWorkdayDetail(row?.workdayId ?? null)
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      width="lg"
      title={row ? `${row.memberName} · ${formatLongDate(row.date)}` : ''}
      description={row?.branchName ?? undefined}
    >
      {detail.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-[12px]" />
          <Skeleton className="h-40 rounded-[12px]" />
        </div>
      ) : detail.isError || !detail.data ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
      ) : (
        <Detail data={detail.data} />
      )}
    </Modal>
  )
}
