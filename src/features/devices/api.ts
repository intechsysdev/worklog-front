import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DeviceControlSettings, DeviceRow, SaveDeviceControlCommand, Verification } from '@/lib/types'

const deviceKeys = {
  settings: ['device-control', 'settings'] as const,
  apps: ['device-control', 'apps'] as const,
  devices: (unassigned: boolean) => ['device-control', 'devices', unassigned] as const,
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

/** Corre las 5 comprobaciones contra MobiControl. */
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
