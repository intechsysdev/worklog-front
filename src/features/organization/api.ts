import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { Branch, SaveBranchCommand, SaveWorkGroupCommand, WorkGroup } from '@/lib/types'

export function useBranches() {
  return useQuery({
    queryKey: keys.branches.all,
    queryFn: () => api.get<Branch[]>('/branches'),
    staleTime: 60_000,
  })
}

export function useGroups(branchId?: string) {
  return useQuery({
    queryKey: keys.groups.list(branchId),
    queryFn: () => api.get<WorkGroup[]>('/groups', { query: { branchId } }),
    staleTime: 60_000,
  })
}

export function useSaveBranch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveBranchCommand }) =>
      id ? api.put<Branch>(`/branches/${id}`, command) : api.post<Branch>('/branches', command),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.branches.all }),
  })
}

export function useSetBranchActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.post<Branch>(`/branches/${id}/active`, { active }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.branches.all }),
  })
}

export function useSaveGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveWorkGroupCommand }) =>
      id ? api.put<WorkGroup>(`/groups/${id}`, command) : api.post<WorkGroup>('/groups', command),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.groups.all })
      void client.invalidateQueries({ queryKey: keys.branches.all })
    },
  })
}

export function useSetGroupActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.post<WorkGroup>(`/groups/${id}/active`, { active }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.groups.all })
      void client.invalidateQueries({ queryKey: keys.branches.all })
    },
  })
}
