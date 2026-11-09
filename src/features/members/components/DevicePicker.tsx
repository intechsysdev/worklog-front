import { Clock, Smartphone } from 'lucide-react'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { DeviceRow } from '@/lib/types'
import { cn, formatDate, formatRelative } from '@/lib/utils'
import { useDevices } from '@/features/devices/api'

function deviceState(device: DeviceRow) {
  if (device.online) return { text: device.batteryPercent != null ? `En línea · ${device.batteryPercent}%` : 'En línea', warn: false }
  return { text: device.lastSeenAt ? `Sin conexión ${formatRelative(device.lastSeenAt)}` : 'Sin conexión', warn: true }
}

/**
 * Paso 3 de Invitar usuario: dispositivos inscritos en MobiControl que aún no tienen usuario.
 * "Asignar después" deja la invitación sin dispositivo (no podrá iniciar jornada hasta tenerlo).
 */
export function DevicePicker({ value, onChange }: { value: string; onChange: (deviceId: string) => void }) {
  const devices = useDevices(true)

  const option = (id: string, title: string, meta: string, state?: { text: string; warn: boolean }, icon = Smartphone) => {
    const selected = value === id
    const Icon = icon
    return (
      <button
        key={id || 'later'}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(id)}
        className={cn(
          'flex w-full items-start gap-3 rounded-[12px] p-3.5 text-left transition-colors',
          selected ? 'border-2 border-accent-solid bg-accent-soft' : 'border border-line hover:border-line-strong',
        )}
      >
        <Icon className={cn('mt-0.5 size-5 shrink-0', selected ? 'text-accent' : 'text-ink-muted')} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-ink">{title}</span>
          <span className="text-[13px] text-ink-muted">{meta}</span>
        </span>
        {state && <span className={cn('text-[13px] whitespace-nowrap', state.warn ? 'font-semibold text-caution' : 'text-ink-soft')}>{state.text}</span>}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">Dispositivos inscritos en SOTI MobiControl que todavía no tienen usuario en WorkLog.</p>
      {devices.isLoading ? (
        <ListSkeleton rows={3} />
      ) : devices.isError ? (
        <ErrorState message={errorMessage(devices.error)} onRetry={() => void devices.refetch()} />
      ) : (
        <div role="radiogroup" aria-label="Dispositivo" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {devices.data?.length === 0 && (
            <EmptyState className="py-6" icon={<Smartphone className="size-5" />} title="No hay dispositivos libres" description="Puedes asignarlo después, cuando MobiControl inscriba uno." />
          )}
          {devices.data?.map((device) =>
            option(
              device.deviceId,
              `${device.model} · ${device.serial}`,
              [device.groupPath, device.enrolledAt && `inscrito el ${formatDate(device.enrolledAt)}`].filter(Boolean).join(' · '),
              deviceState(device),
            ),
          )}
          {option('', 'Asignar después', 'No podrá iniciar jornada hasta tener dispositivo.', undefined, Clock)}
        </div>
      )}
    </div>
  )
}
