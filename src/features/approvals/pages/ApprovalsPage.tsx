import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, CheckCheck, Inbox, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { Pagination } from '@/components/ui/DataTable'
import { Textarea } from '@/components/ui/Field'
import { Card, EmptyState, ErrorState, InlineMessage, KeyValueList, ListSkeleton, PageHeader, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { adjustmentTargetLabel, requestStatusMeta, requestTypeLabel } from '@/lib/labels'
import type { ApprovalDetail, ApprovalRequest, RequestStatus, RequestType } from '@/lib/types'
import { capitalize, cn, formatClock, formatDateTime, formatDayMonth, parseDateOnly, plural } from '@/lib/utils'
import { useBranches } from '@/features/organization/api'
import { useApproval, useApprovals, usePendingApprovals, useResolveApproval } from '../api'

const PAGE_SIZE = 12
type TypeTab = 'all' | RequestType

const tabs: { id: TypeTab; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'RecordAdjustment', label: 'Ajustes' },
  { id: 'Overtime', label: 'Horas extra' },
  { id: 'ShiftChange', label: 'Cambios de turno' },
]

const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

function weekdayDate(value: string) {
  return capitalize(new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }).format(parseDateOnly(value)).replace('.', ''))
}

/** Campos clave-valor del detalle, según el tipo de solicitud (§1, Aprobaciones). */
function detailFields(request: ApprovalRequest) {
  const fields: { label: string; value: ReactNode }[] = []
  if (request.type === 'RecordAdjustment') {
    fields.push({
      label: 'Registro',
      value: `${request.target ? adjustmentTargetLabel[request.target] : 'Registro'} · ${formatDayMonth(request.date)}`,
    })
    if (request.originalValue || request.proposedValue) {
      fields.push({
        label: 'Cambio',
        value: (
          <span className="tabular inline-flex items-center gap-1.5">
            {formatClock(request.originalValue)} <ArrowRight className="size-3.5 text-ink-muted" aria-label="a" /> {formatClock(request.proposedValue)}
          </span>
        ),
      })
    }
  } else if (request.type === 'Overtime') {
    fields.push({
      label: 'Horario',
      value: `${formatClock(request.overtimeFrom)}–${formatClock(request.overtimeTo)} · ${weekdayDate(request.date)}`,
    })
    fields.push({
      label: 'Autorización Mintrabajo',
      value: request.authorizationReference ?? <span className="text-caution">Sin número de resolución</span>,
    })
  } else {
    fields.push({
      label: 'Propuesto',
      value: (
        <ul className="flex flex-col gap-0.5">
          {request.days.map((day) => (
            <li key={day.date} className="tabular">
              {weekdayDate(day.date)} · {day.start && day.end ? `${formatClock(day.start)}–${formatClock(day.end)}` : 'Descanso'}
              {day.lunchMinutes > 0 && <span className="text-ink-muted"> · almuerzo {day.lunchMinutes} min</span>}
            </li>
          ))}
        </ul>
      ),
    })
  }
  fields.push({ label: 'Motivo', value: request.reason || '—' })
  return fields
}

export default function ApprovalsPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<TypeTab>('all')
  const [status, setStatus] = useState<RequestStatus | ''>('Pending')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)

  const branches = useBranches()
  const pending = usePendingApprovals(true)
  const list = useApprovals({
    type: tab === 'all' ? undefined : tab,
    status: status || undefined,
    branchId: branchId || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const items = list.data?.items ?? []
  const selectedId = params.get('id') ?? items[0]?.id ?? null
  const select = (id: string) => setParams({ id }, { replace: true })

  return (
    <>
      <PageHeader
        title="Aprobaciones"
        description={
          <>
            Ajustes, horas extra y cambios de turno de tu equipo
            {pending.data != null && <> · {plural(pending.data, 'pendiente')}</>}
          </>
        }
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-2">
        <Card padded={false} className="flex min-w-0 flex-col self-start" aria-label="Solicitudes">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
            <Segmented
              ariaLabel="Tipo de solicitud"
              items={tabs}
              value={tab}
              onChange={(value) => {
                setTab(value)
                setPage(1)
              }}
              className="self-start"
            />
            <div className="flex flex-wrap gap-2">
              <select aria-label="Estado" value={status} onChange={(event) => { setStatus(event.target.value as RequestStatus | ''); setPage(1) }} className={filterClass}>
                <option value="Pending">Pendientes</option>
                <option value="Approved">Aprobadas</option>
                <option value="Rejected">Rechazadas</option>
                <option value="">Todas</option>
              </select>
              <select aria-label="Sede" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className={filterClass}>
                <option value="">Todas las sedes</option>
                {branches.data
                  ?.filter((branch) => branch.status === 'Active')
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {list.isLoading ? (
            <ListSkeleton rows={5} />
          ) : list.isError ? (
            <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title={status === 'Pending' ? 'No hay solicitudes pendientes' : 'No hay solicitudes con estos filtros'}
              description={status === 'Pending' ? 'Cuando alguien de tu equipo pida un ajuste, horas extra o un cambio de turno, aparecerá aquí.' : 'Prueba con otro tipo o estado.'}
            />
          ) : (
            <ul className={cn('flex flex-col gap-1 p-2 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
              {items.map((item) => {
                const active = item.id === selectedId
                const meta = requestStatusMeta[item.status]
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => select(item.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-[12px] border-2 px-3.5 py-3 text-left transition-colors',
                        active ? 'border-accent-solid bg-accent-soft' : 'border-transparent hover:bg-inset',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{requestTypeLabel[item.type]}</span>
                        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                      </span>
                      <span className="font-semibold text-ink">
                        {item.memberName} · {item.title}
                      </span>
                      <span className="text-[13px] text-ink-soft">{item.detail}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {list.data && list.data.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px] text-ink-muted">
              <Pagination
                page={list.data.page}
                pageSize={list.data.pageSize}
                totalCount={list.data.totalCount}
                totalPages={list.data.totalPages}
                onPageChange={setPage}
                noun={['solicitud', 'solicitudes']}
              />
            </div>
          )}
        </Card>

        {selectedId ? <ApprovalDetailCard key={selectedId} id={selectedId} /> : null}
      </div>
    </>
  )
}

function ApprovalDetailCard({ id }: { id: string }) {
  const detail = useApproval(id)
  const resolve = useResolveApproval()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<{ comment: string }>({ defaultValues: { comment: '' } })

  if (detail.isLoading) {
    return (
      <Card className="flex flex-col gap-4 self-start">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
      </Card>
    )
  }
  if (detail.isError || !detail.data) {
    return (
      <Card padded={false} className="self-start">
        <ErrorState message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
      </Card>
    )
  }

  const { request, effects, warnings }: ApprovalDetail = detail.data
  const meta = requestStatusMeta[request.status]
  const pending = request.status === 'Pending'

  const decide = (decision: 'approve' | 'reject') =>
    handleSubmit(async ({ comment }) => {
      if (decision === 'reject' && comment.trim().length < 3) {
        setError('comment', { type: 'required', message: 'Escribe por qué la rechazas: el usuario recibirá este comentario.' })
        return
      }
      try {
        await resolve.mutateAsync({ id: request.id, decision, comment })
        toast.success(decision === 'approve' ? 'Solicitud aprobada.' : 'Solicitud rechazada.')
      } catch (error) {
        toast.error(errorMessage(error))
      }
    })

  return (
    <Card className="flex min-w-0 flex-col gap-5 self-start" aria-labelledby="approval-title">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{requestTypeLabel[request.type]}</span>
          <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
        </span>
        <h2 id="approval-title" className="text-xl font-bold text-ink">
          {request.memberName} · {request.title}
        </h2>
        <span className="text-[13px] text-ink-muted">Enviada el {formatDateTime(request.submittedAt)}</span>
      </div>

      <KeyValueList items={detailFields(request)} />

      {(effects.length > 0 || warnings.length > 0) && (
        <section aria-labelledby="effects-title" className="flex flex-col gap-2 rounded-[12px] bg-inset p-4">
          <h3 id="effects-title" className="section-label">
            Efecto en las horas
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {effects.map((effect) => (
              <li key={effect} className="tabular flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {effect}
              </li>
            ))}
          </ul>
          {warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm font-semibold text-caution">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {warning}
            </p>
          ))}
        </section>
      )}

      {pending ? (
        <form className="flex flex-col gap-3 border-t border-line pt-4" noValidate onSubmit={(event) => event.preventDefault()}>
          <Textarea
            label="Comentario para el usuario (obligatorio si rechazas)"
            rows={2}
            maxLength={500}
            error={errors.comment?.message}
            {...register('comment')}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<CheckCheck className="size-4" aria-hidden />}
              loading={resolve.isPending && resolve.variables?.decision === 'approve'}
              disabled={resolve.isPending}
              onClick={() => void decide('approve')()}
            >
              Aprobar
            </Button>
            <Button
              variant="danger"
              icon={<X className="size-4" aria-hidden />}
              loading={resolve.isPending && resolve.variables?.decision === 'reject'}
              disabled={resolve.isPending}
              onClick={() => void decide('reject')()}
            >
              Rechazar
            </Button>
          </div>
        </form>
      ) : (
        <InlineMessage tone={request.status === 'Approved' ? 'success' : 'info'}>
          {request.status === 'Approved'
            ? 'Aprobada. El usuario verá el cambio en su historial.'
            : request.status === 'Rejected'
              ? 'Rechazada. El usuario recibirá tu comentario.'
              : 'El usuario canceló la solicitud.'}
          {request.resolverName && (
            <span className="mt-1 block text-[13px] opacity-90">
              Por {request.resolverName}
              {request.resolvedAt && ` · ${formatDateTime(request.resolvedAt)}`}
            </span>
          )}
          {request.resolverComment && <span className="mt-1 block text-[13px] italic">«{request.resolverComment}»</span>}
        </InlineMessage>
      )}
    </Card>
  )
}
