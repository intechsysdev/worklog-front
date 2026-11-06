import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApprovalDetail, ApprovalRequest, Paged, RequestStatus, RequestType } from '@/lib/types'

export const approvalKeys = {
  all: ['approvals'] as const,
  list: (params: unknown) => ['approvals', 'list', params] as const,
  detail: (id: string) => ['approvals', 'detail', id] as const,
  pendingCount: ['approvals', 'pending-count'] as const,
}

export interface ApprovalListParams {
  type?: RequestType
  status?: RequestStatus
  branchId?: string
  page: number
  pageSize: number
}

export function useApprovals(params: ApprovalListParams) {
  return useQuery({
    queryKey: approvalKeys.list(params),
    queryFn: () => api.get<Paged<ApprovalRequest>>('/approvals', { query: { ...params } }),
    placeholderData: keepPreviousData,
  })
}

export function useApproval(id: string | null) {
  return useQuery({
    queryKey: approvalKeys.detail(id ?? ''),
    queryFn: () => api.get<ApprovalDetail>(`/approvals/${id}`),
    enabled: !!id,
  })
}

/** Badge del menú: se refresca cada 60 s mientras el panel está abierto. */
export function usePendingApprovals(enabled: boolean) {
  return useQuery({
    queryKey: approvalKeys.pendingCount,
    queryFn: () => api.get<{ count: number }>('/approvals/pending-count'),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    select: (data) => data.count,
  })
}

export function useResolveApproval() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: 'approve' | 'reject'; comment?: string }) =>
      api.post<ApprovalDetail>(`/approvals/${id}/${decision}`, { comment: comment?.trim() || null }),
    onSuccess: (detail, { id }) => {
      client.setQueryData(approvalKeys.detail(id), detail)
      void client.invalidateQueries({ queryKey: approvalKeys.all, predicate: (query) => query.queryKey[1] !== 'detail' })
      // Aprobar cambia horas, calendario y el estado del cierre.
      void client.invalidateQueries({ queryKey: ['team-hours'] })
      void client.invalidateQueries({ queryKey: ['payroll'] })
      void client.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}
