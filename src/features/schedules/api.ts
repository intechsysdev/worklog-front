import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type {
  Assignment,
  CreateAssignmentCommand,
  MemberCalendar,
  SaveTemplateCommand,
  ScheduleTemplate,
  TemplatePreview,
} from '@/lib/types'

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates.all,
    queryFn: () => api.get<ScheduleTemplate[]>('/schedules/templates'),
    staleTime: 60_000,
  })
}

/** Validación en vivo del editor: no guarda, solo calcula horas y reglas. */
export function previewTemplate(command: SaveTemplateCommand, signal?: AbortSignal) {
  return api.post<TemplatePreview>('/schedules/templates/preview', command, { signal })
}

export function useSaveTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveTemplateCommand }) =>
      id ? api.put<ScheduleTemplate>(`/schedules/templates/${id}`, command) : api.post<ScheduleTemplate>('/schedules/templates', command),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.templates.all })
      void client.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useSetTemplateActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.post<ScheduleTemplate>(`/schedules/templates/${id}/active`, { active }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.templates.all }),
  })
}

export function useAssignments() {
  return useQuery({
    queryKey: keys.assignments.all,
    queryFn: () => api.get<Assignment[]>('/schedules/assignments'),
  })
}

export function useCreateAssignment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (command: CreateAssignmentCommand) => api.post<Assignment>('/schedules/assignments', command),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.assignments.all })
      void client.invalidateQueries({ queryKey: keys.templates.all })
      void client.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useDeleteAssignment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/schedules/assignments/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.assignments.all })
      void client.invalidateQueries({ queryKey: keys.templates.all })
      void client.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useMemberCalendar(memberId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: keys.calendar(memberId ?? '', year, month),
    queryFn: () => api.get<MemberCalendar>(`/schedules/calendar/${memberId}`, { query: { year, month } }),
    enabled: !!memberId,
    placeholderData: (previous) => previous,
  })
}
