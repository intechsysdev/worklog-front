import type { GeoPoint } from '@/lib/types'

const EARTH_RADIUS = 6_371_008.8

/** Límites que valida el dominio (Geofence.cs). */
export const MIN_RADIUS = 30
export const MAX_RADIUS = 500
export const MIN_VERTICES = 3
export const MAX_VERTICES = 50

/** Anillo cerrado [lng, lat] que aproxima un círculo de `radius` metros. */
export function circleRing(center: GeoPoint, radius: number, steps = 64): [number, number][] {
  const lat = (center.latitude * Math.PI) / 180
  const lng = (center.longitude * Math.PI) / 180
  const angular = radius / EARTH_RADIUS
  const ring: [number, number][] = []

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps
    const pointLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing))
    const pointLng =
      lng + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat))
    ring.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI])
  }

  return ring
}

/** Centro de las esquinas (promedio simple: para sitios de cientos de metros basta). */
export function centroid(points: GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null
  const sum = points.reduce((acc, point) => ({ latitude: acc.latitude + point.latitude, longitude: acc.longitude + point.longitude }), {
    latitude: 0,
    longitude: 0,
  })
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length }
}

export const round6 = (value: number) => Math.round(value * 1e6) / 1e6
