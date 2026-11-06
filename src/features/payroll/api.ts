import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ClosePeriodCommand, PayrollSummary, PeriodOption } from '@/lib/types'

const payrollKeys = {
  periods: (branchId: string) => ['payroll', branchId, 'periods'] as const,
  summary: (branchId: string, from: string) => ['payroll', branchId, 'summary', from] as const,
}

export function usePeriods(branchId: string | null) {
  return useQuery({
    queryKey: payrollKeys.periods(branchId ?? ''),
    queryFn: () => api.get<PeriodOption[]>(`/payroll/${branchId}/periods`),
    enabled: !!branchId,
  })
}

export function usePayrollSummary(branchId: string | null, from: string | null) {
  return useQuery({
    queryKey: payrollKeys.summary(branchId ?? '', from ?? ''),
    queryFn: () => api.get<PayrollSummary>(`/payroll/${branchId}/periods/${from}`),
    enabled: !!branchId && !!from,
    placeholderData: keepPreviousData,
  })
}

function usePeriodAction<TBody>(action: 'close' | 'reopen') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, from, body }: { branchId: string; from: string; body?: TBody }) =>
      api.post<PayrollSummary>(`/payroll/${branchId}/periods/${from}/${action}`, body),
    onSuccess: (summary, { branchId, from }) => {
      client.setQueryData(payrollKeys.summary(branchId, from), summary)
      void client.invalidateQueries({ queryKey: payrollKeys.periods(branchId) })
    },
  })
}

export const useClosePeriod = () => usePeriodAction<ClosePeriodCommand>('close')
export const useReopenPeriod = () => usePeriodAction<never>('reopen')

export function exportPeriod(branchId: string, from: string, format: 'Xlsx' | 'Csv') {
  return api.download(`/payroll/${branchId}/periods/${from}/export`, {
    query: { format },
    fileName: `nomina-${from}.${format === 'Xlsx' ? 'xlsx' : 'csv'}`,
  })
}
