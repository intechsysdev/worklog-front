import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TeamHours } from '@/lib/types'

export interface TeamHoursParams {
  /** Cualquier día de la semana a consultar. */
  date: string
  branchId?: string
  onlyAlerts: boolean
}

export function useTeamHours(params: TeamHoursParams) {
  return useQuery({
    queryKey: ['team-hours', params],
    queryFn: () => api.get<TeamHours>('/hours/team', { query: { ...params, onlyAlerts: params.onlyAlerts || undefined } }),
    placeholderData: keepPreviousData,
  })
}
