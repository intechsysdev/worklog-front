import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Absence, AbsencePreview, AbsenceStatus, AbsenceType, Paged, RegisterAbsenceCommand } from '@/lib/types'

export interface AbsenceListParams {
  type?: AbsenceType
  status?: AbsenceStatus
  memberId?: string
  page: number
  pageSize: number
}

export function useAbsences(params: AbsenceListParams) {
  return useQuery({
    queryKey: ['absences', 'list', params],
    queryFn: () => api.get<Paged<Absence>>('/absences', { query: { ...params } }),
    placeholderData: keepPreviousData,
  })
}

/** Cálculo en vivo de días hábiles (descuenta festivos y descansos de la persona). */
export function useAbsencePreview(command: RegisterAbsenceCommand | null) {
  return useQuery({
    queryKey: ['absences', 'preview', command],
    queryFn: ({ signal }) => api.post<AbsencePreview>('/absences/preview', command, { signal }),
    enabled: !!command,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  })
}

function invalidateAbsenceEffects(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ['absences'] })
  // Una novedad aprobada quita el turno: cambia el calendario, Equipo hoy y el cierre.
  void client.invalidateQueries({ queryKey: ['calendar'] })
  void client.invalidateQueries({ queryKey: ['team-today'] })
  void client.invalidateQueries({ queryKey: ['payroll'] })
}

export function useRegisterAbsence() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (command: RegisterAbsenceCommand) => api.post<Absence>('/absences', command),
    onSuccess: () => invalidateAbsenceEffects(client),
  })
}

export function useUploadSupport() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const body = new FormData()
      body.append('file', file)
      return api.post<Absence>(`/absences/${id}/support`, body)
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['absences', 'list'] }),
  })
}

export function useResolveAbsence() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => api.post<Absence>(`/absences/${id}/${decision}`),
    onSuccess: () => invalidateAbsenceEffects(client),
  })
}

export const downloadSupport = (absence: Pick<Absence, 'id' | 'memberName'>) =>
  api.download(`/absences/${absence.id}/support`, { fileName: `soporte-${absence.memberName}` })
