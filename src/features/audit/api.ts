import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AuditEvent, AuditOrigin, Paged } from '@/lib/types'
import { parseDateOnly, toDateOnly } from '@/lib/utils'

export interface AuditFilters {
  origin?: AuditOrigin
  entityType?: string
  from?: string
  to?: string
  search?: string
}

/**
 * El API trata `to` como límite exclusivo (to=3 nov no trae nada del 3): "Hasta" en la pantalla
 * incluye el día, así que se envía el día siguiente.
 */
function toQuery(filters: AuditFilters) {
  if (!filters.to) return { ...filters }
  const next = parseDateOnly(filters.to)
  next.setDate(next.getDate() + 1)
  return { ...filters, to: toDateOnly(next) }
}

export function useAuditEvents(filters: AuditFilters & { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['audit', 'list', filters],
    queryFn: () => api.get<Paged<AuditEvent>>('/audit', { query: toQuery(filters) }),
    placeholderData: keepPreviousData,
  })
}

export function useAuditEvent(id: string | null) {
  return useQuery({
    queryKey: ['audit', 'detail', id],
    queryFn: () => api.get<AuditEvent>(`/audit/${id}`),
    enabled: !!id,
    staleTime: Infinity, // el registro no cambia nunca
  })
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: ['audit', 'entity-types'],
    queryFn: () => api.get<string[]>('/audit/entity-types'),
    staleTime: 10 * 60_000,
  })
}

export const exportAudit = (filters: AuditFilters) =>
  api.download('/audit/export', { query: toQuery(filters), fileName: 'auditoria-worklog.csv' })
