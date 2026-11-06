import { useEffect, useRef, useState } from 'react'
import { Map as MapLibre, Marker, NavigationControl, type GeoJSONSource } from 'maplibre-gl'
import { MAP_STYLE_URL, supportsWebGL } from '@/components/map/maplibre'
import type { Feature as GeoFeature, LineString, Point, Polygon } from 'geojson'
import { MapPinOff } from 'lucide-react'
import type { GeoPoint, GeofenceShape, WorkSite } from '@/lib/types'
import { circleRing } from '../geometry'

const BRAND = '#AF1839'
const MUTED = '#5A5958'

type Feature = GeoFeature<Polygon | LineString | Point, { kind: string }>

function siteFeature(site: Pick<WorkSite, 'shape' | 'latitude' | 'longitude' | 'radiusMeters' | 'vertices'>, kind: string): Feature | null {
  if (site.shape === 'Polygon') {
    if (site.vertices.length < 2) return null
    const ring = site.vertices.map((point) => [point.longitude, point.latitude] as [number, number])
    if (site.vertices.length === 2) return { type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates: ring } }
    return { type: 'Feature', properties: { kind }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]!]] } }
  }
  return {
    type: 'Feature',
    properties: { kind },
    geometry: { type: 'Polygon', coordinates: [circleRing({ latitude: site.latitude, longitude: site.longitude }, site.radiusMeters)] },
  }
}

export interface SiteMapProps {
  shape: GeofenceShape
  center: GeoPoint
  radius: number
  vertices: GeoPoint[]
  /** Otros sitios, en gris, como referencia. */
  others: WorkSite[]
  onCenterChange: (center: GeoPoint) => void
  onAddVertex: (point: GeoPoint) => void
  /** Cambia cuando se elige otro sitio: el mapa se recentra. */
  focusKey: string
}

/**
 * Mapa MapLibre con el estilo Liberty de OpenFreeMap. Círculo: clic o arrastrar el marcador mueve
 * el centro. Polígono: cada clic agrega una esquina. Las coordenadas también se pueden escribir en
 * el formulario, para quien no usa el ratón.
 */
export function SiteMap({ shape, center, radius, vertices, others, onCenterChange, onAddVertex, focusKey }: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const readyRef = useRef(false)
  const drawRef = useRef<() => void>(() => {})
  const [failed, setFailed] = useState(() => !supportsWebGL())
  // El centro inicial y el más reciente, sin volver a crear el mapa en cada cambio.
  const centerRef = useRef(center)
  useEffect(() => {
    centerRef.current = center
  })

  // Los manejadores del mapa leen siempre la versión más reciente de las props.
  const latest = useRef({ shape, onCenterChange, onAddVertex })
  useEffect(() => {
    latest.current = { shape, onCenterChange, onAddVertex }
  })

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current || failed) return
    const initial = centerRef.current

    let map: MapLibre
    try {
      map = new MapLibre({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [initial.longitude, initial.latitude],
        zoom: 16,
        attributionControl: { compact: true },
      })
    } catch {
      queueMicrotask(() => setFailed(true))
      return
    }

    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    const marker = new Marker({ color: BRAND, draggable: true }).setLngLat([initial.longitude, initial.latitude]).addTo(map)
    marker.on('dragend', () => {
      const position = marker.getLngLat()
      latest.current.onCenterChange({ latitude: position.lat, longitude: position.lng })
    })
    markerRef.current = marker

    map.on('load', () => {
      map.addSource('others', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('current', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'others-fill', type: 'fill', source: 'others', paint: { 'fill-color': MUTED, 'fill-opacity': 0.08 } })
      map.addLayer({ id: 'others-line', type: 'line', source: 'others', paint: { 'line-color': MUTED, 'line-width': 1, 'line-dasharray': [2, 2] } })
      map.addLayer({
        id: 'current-fill',
        type: 'fill',
        source: 'current',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': BRAND, 'fill-opacity': 0.16 },
      })
      map.addLayer({ id: 'current-line', type: 'line', source: 'current', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': BRAND, 'line-width': 2 } })
      map.addLayer({
        id: 'current-vertices',
        type: 'circle',
        source: 'current',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-color': BRAND, 'circle-stroke-width': 2 },
      })
      readyRef.current = true
      drawRef.current()
    })

    map.on('click', (event) => {
      const point = { latitude: event.lngLat.lat, longitude: event.lngLat.lng }
      if (latest.current.shape === 'Polygon') latest.current.onAddVertex(point)
      else latest.current.onCenterChange(point)
    })

    map.on('error', (event) => {
      // Un error de teselas no impide dibujar; solo un fallo de WebGL deja el mapa inservible.
      if (String(event.error?.message ?? '').toLowerCase().includes('webgl')) setFailed(true)
    })

    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [failed])

  // Redibujar la geocerca actual y las de referencia.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const draw = () => {
      if (!readyRef.current) return
      const currentFeatures: Feature[] = []
      const shapeFeature = siteFeature({ shape, latitude: center.latitude, longitude: center.longitude, radiusMeters: radius, vertices }, 'current')
      if (shapeFeature) currentFeatures.push(shapeFeature)
      if (shape === 'Polygon') {
        for (const vertex of vertices) {
          currentFeatures.push({ type: 'Feature', properties: { kind: 'vertex' }, geometry: { type: 'Point', coordinates: [vertex.longitude, vertex.latitude] } })
        }
      }
      ;(map.getSource('current') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: currentFeatures })
      ;(map.getSource('others') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: others.map((site) => siteFeature(site, 'other')).filter((feature): feature is Feature => feature !== null),
      })
    }

    drawRef.current = draw
    draw()
  }, [shape, center.latitude, center.longitude, radius, vertices, others])

  // Marcador del centro: solo tiene sentido en el círculo.
  useEffect(() => {
    const marker = markerRef.current
    const map = mapRef.current
    if (!marker || !map) return
    marker.setLngLat([center.longitude, center.latitude])
    const element = marker.getElement()
    element.style.display = shape === 'Circle' ? '' : 'none'
  }, [center.latitude, center.longitude, shape])

  // Al elegir otro sitio, el mapa vuela hasta él.
  useEffect(() => {
    const target = centerRef.current
    mapRef.current?.flyTo({ center: [target.longitude, target.latitude], zoom: 16, duration: 600 })
  }, [focusKey])

  if (failed) {
    return (
      <div className="flex h-full min-h-72 flex-col items-center justify-center gap-2 rounded-[12px] bg-inset p-6 text-center text-sm text-ink-muted">
        <MapPinOff className="size-6" aria-hidden />
        <p>No se pudo mostrar el mapa en este navegador. Puedes escribir las coordenadas en el formulario.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={shape === 'Circle' ? 'Mapa: haz clic para ubicar el centro del sitio' : 'Mapa: haz clic para marcar cada esquina del sitio'}
      className="h-full min-h-72 w-full overflow-hidden rounded-[12px] [&_.maplibregl-canvas]:cursor-crosshair"
    />
  )
}
