import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DeviceControlSettings, DeviceRow, OneLink, SaveDeviceControlCommand, SaveOneLinkCommand, Verification } from '@/lib/types'

const deviceKeys = {
  settings: ['device-control', 'settings'] as const,
  apps: ['device-control', 'apps'] as const,
  devices: (unassigned: boolean) => ['device-control', 'devices', unassigned] as const,
  oneLink: ['integrations', 'one'] as const,
}

/** Vínculo con INTECHSYS ONE: la credencial con que WorkLog lee la consola de MobiControl de la empresa. */
export function useOneLink() {
  return useQuery({ queryKey: deviceKeys.oneLink, queryFn: () => api.get<OneLink>('/integrations/one') })
}

/** Vuelve a preguntarle a ONE, sin la caché del servidor. */
export function useCheckOneLink() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<OneLink>('/integrations/one/check'),
    onSuccess: (link) => client.setQueryData(deviceKeys.oneLink, link),
  })
}

/** Al cambiar el vínculo cambia de dónde salen los equipos: se recargan con el estado nuevo. */
export function useSaveOneLink() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (command: SaveOneLinkCommand) => api.put<OneLink>('/integrations/one', command),
    onSuccess: (link) => {
      client.setQueryData(deviceKeys.oneLink, link)
      void client.invalidateQueries({ queryKey: ['device-control'] })
    },
  })
}

export function useRemoveOneLink() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/integrations/one'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: deviceKeys.oneLink })
      void client.invalidateQueries({ queryKey: ['device-control'] })
    },
  })
}

export function useDeviceSettings() {
  return useQuery({ queryKey: deviceKeys.settings, queryFn: () => api.get<DeviceControlSettings>('/device-control/settings') })
}

export function useSaveDeviceSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (command: SaveDeviceControlCommand) => api.put<DeviceControlSettings>('/device-control/settings', command),
    onSuccess: (settings) => client.setQueryData(deviceKeys.settings, settings),
  })
}

/** Comprueba el vínculo con ONE, la conexión con la consola y las órdenes de jornada. */
export function useVerifyDeviceControl() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Verification>('/device-control/verify'),
    onSuccess: () => void client.invalidateQueries({ queryKey: deviceKeys.settings }),
  })
}

/** Catálogo de apps (paquetes) leído de MobiControl. */
export function useDeviceApps() {
  return useQuery({ queryKey: deviceKeys.apps, queryFn: () => api.get<string[]>('/device-control/apps'), staleTime: 5 * 60_000 })
}

export function useDevices(unassigned = false, enabled = true) {
  return useQuery({
    queryKey: deviceKeys.devices(unassigned),
    queryFn: () => api.get<DeviceRow[]>('/device-control/devices', { query: { unassigned: unassigned || undefined } }),
    refetchInterval: unassigned ? false : 60_000,
    enabled,
  })
}

export function useAssignDevice() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, deviceId }: { memberId: string; deviceId: string | null }) => api.put(`/members/${memberId}/device`, { deviceId }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['device-control', 'devices'] })
      void client.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
