import { Drawer } from '@/components/ui/Modal'
import { ErrorState, KeyValueList, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { auditOriginMeta } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useAuditEvent } from '../api'

type Json = Record<string, unknown>

function parse(value?: string): Json | string | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Json) : value
  } catch {
    return value
  }
}

/** "targetName" → "Target name". */
const humanize = (key: string) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const show = (value: unknown) => {
  if (value === undefined) return '—'
  if (value === null) return 'vacío'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Diff legible campo a campo; si el antes o el después no es JSON, se muestran tal cual. */
function Diff({ before, after }: { before?: string; after?: string }) {
  const a = parse(before)
  const b = parse(after)

  if (!a && !b) return <p className="text-sm text-ink-muted">Este evento no guarda valores antes y después.</p>

  if (typeof a === 'string' || typeof b === 'string') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Antes', value: before },
          { label: 'Después', value: after },
        ].map((side) => (
          <div key={side.label} className="flex flex-col gap-1">
            <span className="section-label">{side.label}</span>
            <pre className="overflow-x-auto rounded-[10px] bg-inset p-3 text-[12px] whitespace-pre-wrap text-ink-soft">{side.value ?? '—'}</pre>
          </div>
        ))}
      </div>
    )
  }

  const keys = Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]))
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Cambios del evento</caption>
      <thead>
        <tr className="text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          <th scope="col" className="py-2 pr-3">Campo</th>
          <th scope="col" className="py-2 pr-3">Antes</th>
          <th scope="col" className="py-2">Después</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const old = a?.[key]
          const now = b?.[key]
          const changed = JSON.stringify(old) !== JSON.stringify(now)
          return (
            <tr key={key} className="border-t border-divider align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-soft">
                {humanize(key)}
              </th>
              <td className={cn('py-2 pr-3 break-all', changed && a ? 'text-critical line-through decoration-1' : 'text-ink-muted')}>{a ? show(old) : '—'}</td>
              <td className={cn('py-2 break-all', changed ? 'font-semibold text-positive' : 'text-ink')}>{b ? show(now) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const fullDate = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'medium', hour12: false }).format(new Date(value))

const clock = (value: string) => new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

export function AuditDetail({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const event = useAuditEvent(id)
  const data = event.data

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Detalle"
      title={data?.summary ?? 'Evento de auditoría'}
      description={data && <StatusChip tone={auditOriginMeta[data.origin].tone}>{auditOriginMeta[data.origin].label}</StatusChip>}
    >
      {event.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      ) : event.isError || !data ? (
        <ErrorState message={errorMessage(event.error)} onRetry={() => void event.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <KeyValueList
            items={[
              {
                label: 'Fecha y hora',
                value: (
                  <>
                    {fullDate(data.occurredAt)}
                    {data.receivedAt && clock(data.receivedAt) !== clock(data.occurredAt) && (
                      <span className="block text-[13px] font-normal text-ink-muted">(recibido {clock(data.receivedAt)}, venía sin conexión)</span>
                    )}
                  </>
                ),
              },
              { label: 'Quién', value: data.actorRole ? `${data.actorName} · ${data.actorRole}` : data.actorName },
              { label: 'Entidad', value: data.entityType },
              { label: 'Origen', value: auditOriginMeta[data.origin].long },
              { label: 'Acción', value: <code className="text-[12px] text-ink-soft">{data.action}</code> },
            ]}
          />
          <section aria-labelledby="audit-diff-title" className="flex flex-col gap-2">
            <h3 id="audit-diff-title" className="section-label">
              Antes y después
            </h3>
            <Diff before={data.before} after={data.after} />
          </section>
        </div>
      )}
    </Drawer>
  )
}
