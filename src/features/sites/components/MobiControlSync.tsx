import { toast } from 'sonner'
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { WorkSite } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useSyncSites } from '../api'

/** Estado corto del sitio en MobiControl, para la lista. */
export function MobiControlBadge({ site }: { site: WorkSite }) {
  if (!site.isActive && !site.mobiControlName) return null
  if (site.mobiControlName && !site.mobiControlError)
    return (
      <span className="flex items-center gap-1 text-[12px] text-positive">
        <CloudCheck className="size-3.5" aria-hidden />
        En MobiControl
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[12px] text-caution" title={site.mobiControlError ?? undefined}>
      <CloudOff className="size-3.5" aria-hidden />
      Pendiente en MobiControl
    </span>
  )
}

/** Detalle del sitio en MobiControl, con reintento. Un fallo de la consola no impide usar el sitio en WorkLog. */
export function MobiControlStatus({ site }: { site: WorkSite }) {
  const sync = useSyncSites()

  const retry = () =>
    sync.mutate(site.id, {
      onSuccess: ([result]) =>
        result?.mobiControlError
          ? toast.warning(`Sigue pendiente: ${result.mobiControlError}`)
          : toast.success(result?.isActive ? 'El sitio quedó en MobiControl.' : 'El sitio ya no está en MobiControl.'),
      onError: (error) => toast.error(errorMessage(error)),
    })

  const inConsole = !!site.mobiControlName && !site.mobiControlError
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-inset px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">
            {inConsole ? 'Geocerca en MobiControl' : site.isActive ? 'Pendiente en MobiControl' : 'No está en MobiControl'}
          </span>
          {site.mobiControlName && (
            <span className="truncate text-[12px] text-ink-muted">
              {site.mobiControlName}
              {site.mobiControlSyncedAt && ` · ${formatDateTime(site.mobiControlSyncedAt)}`}
            </span>
          )}
        </span>
        {(site.mobiControlError || (site.isActive && !site.mobiControlName)) && (
          <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={sync.isPending} onClick={retry}>
            Reintentar
          </Button>
        )}
      </div>
      {site.mobiControlError && <InlineMessage tone="warning">{site.mobiControlError}</InlineMessage>}
    </div>
  )
}

/** Lleva todos los sitios a MobiControl (crea, renombra o borra lo que falte). */
export function SyncAllButton() {
  const sync = useSyncSites()
  const run = () =>
    sync.mutate(undefined, {
      onSuccess: (result) => {
        const pending = result.filter((site) => site.mobiControlError).length
        if (pending === 0) toast.success(`${result.length} sitio(s) al día en MobiControl.`)
        else toast.warning(`${pending} de ${result.length} sitio(s) quedaron pendientes: ${result.find((s) => s.mobiControlError)?.mobiControlError}`)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <Button icon={<RefreshCw className="size-4" aria-hidden />} loading={sync.isPending} onClick={run}>
      Sincronizar con MobiControl
    </Button>
  )
}
