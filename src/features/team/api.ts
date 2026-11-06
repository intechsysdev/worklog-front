import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { MemberLocations, TeamFilter, TeamToday } from '@/lib/types'

export interface TeamTodayParams {
  branchId?: string
  filter: TeamFilter
  search?: string
}

/** "Equipo hoy" se refresca solo cada 60 s mientras la pestaña está abierta. */
export function useTeamToday(params: TeamTodayParams) {
  return useQuery({
    queryKey: keys.teamToday(params),
    queryFn: () =>
      api.get<TeamToday>('/team/today', {
        query: { branchId: params.branchId, filter: params.filter, search: params.search },
      }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}

/** Puntos de un día. Requiere view_locations y el API deja la consulta en la auditoría. */
export function useMemberLocations(memberId: string | null, date: string) {
  return useQuery({
    queryKey: ['locations', memberId, date],
    queryFn: () => api.get<MemberLocations>(`/members/${memberId}/locations`, { query: { date } }),
    enabled: !!memberId,
    // Cada lectura queda auditada: no se repite sola.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}
