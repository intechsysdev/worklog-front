import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { ImportReport, Paged, SaveWorkOrderCommand, WorkOrder, WorkOrderStatus } from '@/lib/types'

export interface WorkOrderListParams {
  page: number
  pageSize: number
  search?: string
  from?: string
  to?: string
  assigneeId?: string
  workSiteId?: string
  status?: WorkOrderStatus
}

export function useWorkOrders(params: WorkOrderListParams) {
  return useQuery({
    queryKey: keys.workOrders.list(params),
    queryFn: () =>
      api.get<Paged<WorkOrder>>('/work-orders', {
        query: {
          Page: params.page,
          PageSize: params.pageSize,
          Search: params.search,
          From: params.from,
          To: params.to,
          AssigneeId: params.assigneeId,
          WorkSiteId: params.workSiteId,
          Status: params.status,
        },
      }),
    placeholderData: keepPreviousData,
  })
}

export function useSaveWorkOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveWorkOrderCommand }) =>
      id ? api.put<WorkOrder>(`/work-orders/${id}`, command) : api.post<WorkOrder>('/work-orders', command),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.workOrders.all })
      void client.invalidateQueries({ queryKey: keys.sites.all })
    },
  })
}

export function useCancelWorkOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<WorkOrder>(`/work-orders/${id}/cancel`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.workOrders.all }),
  })
}

export function useImportWorkOrders() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api.post<ImportReport>('/work-orders/import', body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.workOrders.all })
      void client.invalidateQueries({ queryKey: keys.sites.all })
    },
  })
}
