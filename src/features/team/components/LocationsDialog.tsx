import { useEffect, useMemo, useRef, useState } from 'react'
import { LngLatBounds, Map as MapLibre, NavigationControl, Popup, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { MapPinOff } from 'lucide-react'
import { MAP_STYLE_URL, supportsWebGL } from '@/components/map/maplibre'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, InlineMessage, Skeleton } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { GeofenceStatus, LocationEvent, LocationPoint } from '@/lib/types'
import { cn, formatClock, todayDateOnly } from '@/lib/utils'
import { useMemberLocations } from '../api'

const eventLabel: Record<LocationEvent, string> = {
  WorkdayStart: 'Inicio de jornada',
  ActivityStart: 'Inicio de actividad',
  ActivityFinish: 'Fin de actividad',
  Pause: 'Pausa',
  Resume: 'Reanudó',
  Sample: 'Muestreo',
  WorkdayClose: 'Cierre de jornada',
}

const geofenceMeta: Record<GeofenceStatus, { label: string; color: string; className: string }> = {
  Inside: { label: 'Dentro de la geocerca', color: '#1E7A46', className: 'bg-positive-dot' },
  Outside: { label: 'Fuera de la geocerca', color: '#DA830B', className: 'bg-caution-dot' },
  Unknown: { label: 'Precisión insuficiente', color: '#868787', className: 'bg-ink-subtle' },
  NoLocation: { label: 'Sin ubicación', color: '#868787', className: 'bg-ink-subtle' },
  NotApplicable: { label: 'Sin sitio asignado', color: '#5A5958', className: 'bg-neutral-dot' },
}

function PointsMap({ points }: { points: LocationPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(() => !supportsWebGL())

  useEffect(() => {
    if (!containerRef.current || failed || points.length === 0) return

    const ordered = [...points].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    const map = new MapLibre({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [ordered[0]!.longitude, ordered[0]!.latitude],
      zoom: 15,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    const route: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ordered.map((p) => [p.longitude, p.latitude]) } }],
    }
    const dots: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: ordered.map((point, index) => ({
        type: 'Feature',
        id: index,
        properties: {
          color: geofenceMeta[point.geofence].color,
          title: `${formatClock(point.capturedAt)} · ${eventLabel[point.event]}`,
          detail: `${geofenceMeta[point.geofence].label} · precisión ${Math.round(point.accuracyMeters)} m`,
        },
        geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      })),
    }

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: route })
      map.addSource('points', { type: 'geojson', data: dots })
      map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#3C3C3B', 'line-width': 2, 'line-opacity': 0.45, 'line-dasharray': [2, 2] } })
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 },
      })
      ;(map.getSource('points') as GeoJSONSource | undefined)?.setData(dots)

      if (ordered.length > 1) {
        const bounds = new LngLatBounds()
        for (const point of ordered) bounds.extend([point.longitude, point.latitude])
        map.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 0 })
      }
    })

    map.on('click', 'points', (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      new Popup({ closeButton: false })
        .setLngLat(event.lngLat)
        .setHTML(`<strong>${String(feature.properties?.title ?? '')}</strong><br>${String(feature.properties?.detail ?? '')}`)
        .addTo(map)
    })
    map.on('mouseenter', 'points', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'points', () => (map.getCanvas().style.cursor = ''))
    map.on('error', (event) => {
      if (String(event.error?.message ?? '').toLowerCase().includes('webgl')) setFailed(true)
    })

    return () => map.remove()
  }, [points, failed])

  if (failed) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-[12px] bg-inset p-6 text-center text-sm text-ink-muted">
        <MapPinOff className="size-6" aria-hidden />
        No se pudo mostrar el mapa en este navegador. Abajo está la lista de puntos.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Mapa con ${points.length} puntos de ubicación`}
      className="h-72 w-full overflow-hidden rounded-[12px] [&_.maplibregl-popup-content]:rounded-[10px] [&_.maplibregl-popup-content]:text-[13px] [&_.maplibregl-popup-content]:text-[#1E1F1D]"
    />
  )
}

/** "Ver ubicación" de Equipo hoy. Cada consulta queda en la auditoría (la registra el API). */
export default function LocationsDialog({ member, onClose }: { member: { id: string; name: string } | null; onClose: () => void }) {
  const [date, setDate] = useState(todayDateOnly())
  const locations = useMemberLocations(member?.id ?? null, date)
  const points = useMemo(
    () => [...(locations.data?.points ?? [])].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    [locations.data],
  )

  const inside = points.filter((point) => point.geofence === 'Inside').length
  const outside = points.filter((point) => point.geofence === 'Outside').length

  return (
    <Modal open={!!member} onClose={onClose} width="lg" title={`Ubicación de ${member?.name ?? ''}`}>
      <div className="flex flex-col gap-4">
        <InlineMessage tone="warning">
          Esta consulta queda registrada en la auditoría con tu nombre. Úsala solo cuando la operación lo requiera.
        </InlineMessage>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <Input label="Día" type="date" value={date} max={todayDateOnly()} onChange={(event) => setDate(event.target.value || todayDateOnly())} wrapperClassName="w-48" />
          {points.length > 0 && (
            <p className="text-sm text-ink-soft">
              <span className="tabular font-semibold text-positive">{inside}</span> dentro ·{' '}
              <span className="tabular font-semibold text-caution">{outside}</span> fuera · {points.length} puntos
            </p>
          )}
        </div>

        {locations.isLoading ? (
          <Skeleton className="h-72 rounded-[12px]" />
        ) : locations.isError ? (
          <ErrorState message={errorMessage(locations.error)} onRetry={() => void locations.refetch()} />
        ) : points.length === 0 ? (
          <EmptyState icon={<MapPinOff className="size-5" />} title="Sin puntos ese día" description="No hay ubicaciones registradas para esta persona en la fecha elegida." />
        ) : (
          <>
            <PointsMap points={points} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft" aria-label="Leyenda">
              {(['Inside', 'Outside', 'NotApplicable'] as const).map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-full', geofenceMeta[status].className)} aria-hidden />
                  {geofenceMeta[status].label}
                </li>
              ))}
            </ul>
            <ol className="max-h-56 overflow-y-auto rounded-[12px] border border-line">
              {points.map((point, index) => (
                <li key={`${point.capturedAt}-${index}`} className="flex items-center gap-3 border-t border-divider px-4 py-2 text-sm first:border-t-0">
                  <span className={cn('size-2.5 shrink-0 rounded-full', geofenceMeta[point.geofence].className)} aria-hidden />
                  <span className="tabular w-12 font-semibold text-ink">{formatClock(point.capturedAt)}</span>
                  <span className="flex-1 text-ink-soft">{eventLabel[point.event]}</span>
                  <span className="text-[13px] text-ink-muted">
                    {geofenceMeta[point.geofence].label} · {Math.round(point.accuracyMeters)} m
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Modal>
  )
}
