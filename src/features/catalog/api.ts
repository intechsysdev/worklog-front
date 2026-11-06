import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type {
  ActivityOutcome,
  ActivityType,
  Catalog,
  Category,
  OutcomeSetting,
  PatchActivityTypeCommand,
  SaveActivityTypeCommand,
  SaveCategoryCommand,
} from '@/lib/types'

export function useCatalog() {
  return useQuery({
    queryKey: keys.catalog,
    queryFn: () => api.get<Catalog>('/catalog'),
    staleTime: 60_000,
  })
}

export function useSaveActivity() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveActivityTypeCommand }) =>
      id ? api.put<ActivityType>(`/catalog/activities/${id}`, command) : api.post<ActivityType>('/catalog/activities', command),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog }),
  })
}

/** Interruptores de la tabla: cambio optimista, se revierte si el API se niega. */
export function usePatchActivity() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchActivityTypeCommand }) => api.patch<ActivityType>(`/catalog/activities/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: keys.catalog })
      const previous = client.getQueryData<Catalog>(keys.catalog)
      client.setQueryData<Catalog>(keys.catalog, (catalog) =>
        catalog
          ? {
              ...catalog,
              activities: catalog.activities.map((activity) =>
                activity.id === id
                  ? {
                      ...activity,
                      requiresPhoto: patch.requiresPhoto ?? activity.requiresPhoto,
                      requiresSignature: patch.requiresSignature ?? activity.requiresSignature,
                      observation: patch.observation ?? activity.observation,
                      isActive: patch.isActive ?? activity.isActive,
                    }
                  : activity,
              ),
            }
          : catalog,
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(keys.catalog, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.catalog }),
  })
}

export function useSetOutcome() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ outcome, requiresObservation }: { outcome: ActivityOutcome; requiresObservation: boolean }) =>
      api.put<OutcomeSetting>(`/catalog/outcomes/${outcome}`, { requiresObservation }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog }),
  })
}

export function useSaveCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, command }: { id?: string; command: SaveCategoryCommand }) =>
      id ? api.put<Category>(`/catalog/categories/${id}`, command) : api.post<Category>('/catalog/categories', command),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog }),
  })
}

/** Una categoría con actividades activas no se desactiva (409). */
export function useSetCategoryActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.post<Category>(`/catalog/categories/${id}/active`, { active }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog }),
  })
}
