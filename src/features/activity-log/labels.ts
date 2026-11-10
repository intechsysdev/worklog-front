import type { ChipTone } from '@/components/ui/Primitives'
import type { ActivityLogRow, GeofenceStatus } from '@/lib/types'

export const geofenceChip: Record<GeofenceStatus, { label: string; tone: ChipTone }> = {
  Inside: { label: 'Dentro de la geocerca', tone: 'positive' },
  Outside: { label: 'Fuera de la geocerca', tone: 'caution' },
  Unknown: { label: 'Precisión insuficiente', tone: 'neutral' },
  NoLocation: { label: 'Sin ubicación', tone: 'neutral' },
  NotApplicable: { label: 'Sin sitio', tone: 'outline' },
}

export function workdayStatusChip(row: ActivityLogRow): { label: string; tone: ChipTone } {
  if (row.status === 'Open') return { label: 'En curso', tone: 'accent' }
  if (row.status === 'PendingReview') return { label: 'Cierre automático', tone: 'caution' }
  return row.closeKind === 'Automatic' ? { label: 'Cerrada automáticamente', tone: 'neutral' } : { label: 'Cerrada', tone: 'positive' }
}
