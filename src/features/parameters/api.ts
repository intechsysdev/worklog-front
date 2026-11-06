import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { ParameterLevel, ParameterRow, SetParameterCommand } from '@/lib/types'

export function useParameters(level: ParameterLevel, scope?: string) {
  return useQuery({
    queryKey: keys.parameters(level, scope),
    queryFn: () => api.get<ParameterRow[]>(`/parameters/${level}`, { query: { scope } }),
    enabled: (level !== 'Country' && level !== 'Branch') || !!scope,
  })
}

/** Guardar y "Usar el heredado" devuelven la tabla del nivel ya recalculada. */
export function useSetParameter(level: ParameterLevel, scope?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ code, command }: { code: string; command: SetParameterCommand }) =>
      api.put<ParameterRow[]>(`/parameters/${level}/${code}`, command, { query: { scope } }),
    onSuccess: (rows) => {
      client.setQueryData(keys.parameters(level, scope), rows)
      // Los niveles de abajo heredan: se recalculan al volver a ellos.
      void client.invalidateQueries({ queryKey: ['parameters'], predicate: (query) => query.queryKey[1] !== level })
    },
  })
}

export function useResetParameter(level: ParameterLevel, scope?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.delete<ParameterRow[]>(`/parameters/${level}/${code}`, { query: { scope } }),
    onSuccess: (rows) => {
      if (rows) client.setQueryData(keys.parameters(level, scope), rows)
      else void client.invalidateQueries({ queryKey: keys.parameters(level, scope) })
      void client.invalidateQueries({ queryKey: ['parameters'], predicate: (query) => query.queryKey[1] !== level })
    },
  })
}
