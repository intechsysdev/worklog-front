import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { SaveWorkSiteCommand, WorkSite } from '@/lib/types'

export function useSites(includeInactive = false) {
  return useQuery({
    queryKey: keys.sites.list(includeInactive),
    queryFn: () => api.get<WorkSite[]>('/sites', { query: { includeInactive } }),
    staleTime: 60_000,
  })
}

export function useSaveSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveWorkSiteCommand }) =>
      id ? api.put<WorkSite>(`/sites/${id}`, command) : api.post<WorkSite>('/sites', command),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.sites.all }),
  })
}

/** Lleva a MobiControl un sitio (con su id) o todos (sin id). */
export function useSyncSites() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => api.post<WorkSite[]>(id ? `/sites/${id}/mobicontrol-sync` : '/sites/mobicontrol-sync'),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.sites.all }),
  })
}

export function useSetSiteActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.post<WorkSite>(`/sites/${id}/active`, { active }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.sites.all }),
  })
}
