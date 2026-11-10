import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActivityLog, WorkdayDetail } from '@/lib/types'

export interface ActivityLogFilter {
  from: string
  to: string
  memberId?: string
  branchId?: string
}

const query = (filter: ActivityLogFilter) => ({
  from: filter.from,
  to: filter.to,
  memberId: filter.memberId || undefined,
  branchId: filter.branchId || undefined,
})

/** Jornadas de las personas en un rango (máx. 31 días). */
export function useActivityLog(filter: ActivityLogFilter) {
  return useQuery({
    queryKey: ['activity-log', filter],
    queryFn: () => api.get<ActivityLog>('/activity-log', { query: query(filter) }),
    placeholderData: keepPreviousData,
  })
}

export function useWorkdayDetail(workdayId: string | null) {
  return useQuery({
    queryKey: ['activity-log', 'workday', workdayId],
    queryFn: () => api.get<WorkdayDetail>(`/activity-log/workdays/${workdayId}`),
    enabled: !!workdayId,
  })
}

export const exportActivityLog = (filter: ActivityLogFilter) =>
  api.download('/activity-log/export', { query: query(filter), fileName: `registro-actividades-${filter.from}-${filter.to}` })

/**
 * Foto o firma como URL local. Se descarga con el token (no se puede poner en un <img src>). Las URL
 * quedan en la caché de la consulta mientras dure la sesión: son pocas y pesan solo lo que la imagen.
 */
export function useEvidenceUrl(evidenceId: string | null) {
  const file = useQuery({
    queryKey: ['activity-log', 'evidence', evidenceId],
    queryFn: async () => URL.createObjectURL(await api.blob(`/activity-log/evidence/${evidenceId}`)),
    enabled: !!evidenceId,
    staleTime: Infinity,
  })
  return { url: file.data ?? null, isLoading: file.isLoading, isError: file.isError }
}
