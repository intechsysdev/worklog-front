import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { Member, MemberStatus, MemberUsage, Paged, PermissionInfo, Role, SaveMemberCommand } from '@/lib/types'

export interface MemberListParams {
  page: number
  pageSize: number
  search?: string
  branchId?: string
  workGroupId?: string
  roleId?: string
  status?: MemberStatus
  usage?: MemberUsage
}

export function useMembers(params: MemberListParams) {
  return useQuery({
    queryKey: keys.members.list(params),
    queryFn: () =>
      api.get<Paged<Member>>('/members', {
        query: {
          Page: params.page,
          PageSize: params.pageSize,
          Search: params.search,
          BranchId: params.branchId,
          WorkGroupId: params.workGroupId,
          RoleId: params.roleId,
          Status: params.status,
          Usage: params.usage,
        },
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Personas para los selectores (supervisor, destino de asignaciones, técnico de una OT).
 * El API pagina hasta 200 por página: suficiente para el MVP.
 * TODO(API): un endpoint ligero /members/options evitaría traer el detalle completo.
 */
export function useMemberOptions(enabled = true) {
  return useQuery({
    queryKey: keys.members.options,
    queryFn: async () => (await api.get<Paged<Member>>('/members', { query: { Page: 1, PageSize: 200 } })).items,
    staleTime: 60_000,
    enabled,
  })
}

export function useSaveMember() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveMemberCommand }) =>
      id ? api.put<Member>(`/members/${id}`, command) : api.post<Member>('/members', command),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.members.all })
      void client.invalidateQueries({ queryKey: keys.roles })
    },
  })
}

export function useSetMemberActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.post<Member>(`/members/${id}/active`, { active }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members.all }),
  })
}

export function useUnlinkDevice() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Member | undefined>(`/members/${id}/device`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members.all }),
  })
}

export function useRoles() {
  return useQuery({
    queryKey: keys.roles,
    queryFn: () => api.get<Role[]>('/roles'),
    staleTime: 60_000,
  })
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: keys.permissions,
    queryFn: () => api.get<PermissionInfo[]>('/roles/permissions'),
    staleTime: Infinity,
  })
}

export function useSetRolePermissions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      api.put<Role>(`/roles/${id}/permissions`, { permissions }),
    onMutate: async ({ id, permissions }) => {
      // Optimista: la celda cambia al instante y vuelve atrás si el API se niega.
      await client.cancelQueries({ queryKey: keys.roles })
      const previous = client.getQueryData<Role[]>(keys.roles)
      client.setQueryData<Role[]>(keys.roles, (roles) =>
        roles?.map((role) => (role.id === id ? { ...role, permissions } : role)),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(keys.roles, context.previous)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.roles })
      void client.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useCreateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (command: { name: string; copyFromRoleId?: string | null }) => api.post<Role>('/roles', command),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.roles }),
  })
}
