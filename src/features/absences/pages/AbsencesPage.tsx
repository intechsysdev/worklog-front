import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Download, Paperclip, Palmtree, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { absenceStatusMeta, absenceTypeLabel } from '@/lib/labels'
import type { Absence, AbsenceStatus, AbsenceType } from '@/lib/types'
import { formatClock, formatDate, formatMinutes, parseDateOnly } from '@/lib/utils'
import { downloadSupport, useAbsences, useResolveAbsence, useUploadSupport } from '../api'
import { RegisterAbsenceForm } from '../components/RegisterAbsenceForm'

const PAGE_SIZE = 20
type TypeTab = 'all' | AbsenceType

const tabs: { id: TypeTab; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'Vacation', label: 'Vacaciones' },
  { id: 'SickLeave', label: 'Incapacidades' },
  { id: 'Leave', label: 'Licencias' },
  { id: 'Permission', label: 'Permisos' },
  { id: 'CompensatoryTime', label: 'Compensatorios' },
]

const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(parseDateOnly(value)).replace('.', '')

function datesText(absence: Absence) {
  if (absence.fromTime && absence.toTime) {
    const duration = absence.partialMinutes ? ` · ${formatMinutes(absence.partialMinutes)}` : ''
    return `${shortDate(absence.from)} · ${formatClock(absence.fromTime)}–${formatClock(absence.toTime)}${duration}`
  }
  if (absence.from === absence.to) return formatDate(absence.from)
  const from = parseDateOnly(absence.from)
  const to = parseDateOnly(absence.to)
  const month = (date: Date) => new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '')
  // "23–27 nov 2026" en el mismo mes; "30 nov – 2 dic 2026" si cruza de mes.
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) return `${from.getDate()}–${to.getDate()} ${month(to)} ${to.getFullYear()}`
  return `${shortDate(absence.from)} – ${shortDate(absence.to)} ${to.getFullYear()}`
}

export default function AbsencesPage() {
  const [tab, setTab] = useState<TypeTab>('all')
  const [status, setStatus] = useState<AbsenceStatus | ''>('')
  const [page, setPage] = useState(1)
  const absences = useAbsences({ type: tab === 'all' ? undefined : tab, status: status || undefined, page, pageSize: PAGE_SIZE })
  const resolve = useResolveAbsence()
  const upload = useUploadSupport()
  const [rejecting, setRejecting] = useState<Absence | null>(null)
  const uploadTarget = useRef<Absence | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const decide = (absence: Absence, decision: 'approve' | 'reject') =>
    resolve.mutate(
      { id: absence.id, decision },
      {
        onSuccess: () => {
          toast.success(
            decision === 'approve'
              ? `Novedad aprobada: ${absence.memberName} no tendrá turno esos días.`
              : `Novedad de ${absence.memberName} rechazada.`,
          )
          setRejecting(null)
        },
        onError: (error) => {
          toast.error(errorMessage(error))
          setRejecting(null)
        },
      },
    )

  const startUpload = (absence: Absence) => {
    uploadTarget.current = absence
    fileInput.current?.click()
  }

  const onFile = (file: File | undefined) => {
    const target = uploadTarget.current
    if (!file || !target) return
    upload.mutate(
      { id: target.id, file },
      {
        onSuccess: () => toast.success(`Soporte adjuntado a la novedad de ${target.memberName}.`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const columns: Column<Absence>[] = [
    { key: 'name', header: 'Usuario', className: 'min-w-36', render: (absence) => <span className="font-semibold text-ink">{absence.memberName}</span> },
    { key: 'type', header: 'Tipo', render: (absence) => absence.typeLabel || absenceTypeLabel[absence.type] },
    { key: 'dates', header: 'Fechas', render: (absence) => <span className="tabular whitespace-nowrap">{datesText(absence)}</span> },
    {
      key: 'days',
      header: 'Días háb.',
      align: 'right',
      render: (absence) => <span className="tabular">{absence.fromTime ? '—' : absence.businessDays}</span>,
    },
    {
      key: 'support',
      header: 'Soporte',
      render: (absence) =>
        absence.hasSupport ? (
          <Button variant="tertiary" size="sm" icon={<Download className="size-3.5" aria-hidden />} onClick={() => void downloadSupport(absence).catch((error: unknown) => toast.error(errorMessage(error)))}>
            Ver soporte
          </Button>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className={absence.type === 'SickLeave' ? 'text-[13px] font-semibold text-caution' : 'text-[13px] text-ink-muted'}>
              {absence.type === 'SickLeave' ? 'Falta soporte EPS' : 'Sin soporte'}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Adjuntar soporte a la novedad de ${absence.memberName}`}
              title="Adjuntar soporte"
              loading={upload.isPending && upload.variables?.id === absence.id}
              onClick={() => startUpload(absence)}
            >
              <Paperclip className="size-3.5" aria-hidden />
            </Button>
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (absence) =>
        absence.status === 'Pending' ? (
          <span className="inline-flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              icon={<Check className="size-3.5" aria-hidden />}
              loading={resolve.isPending && resolve.variables?.id === absence.id && resolve.variables.decision === 'approve'}
              disabled={resolve.isPending}
              onClick={() => decide(absence, 'approve')}
            >
              Aprobar
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Rechazar la novedad de ${absence.memberName}`} title="Rechazar" disabled={resolve.isPending} onClick={() => setRejecting(absence)}>
              <X className="size-4" aria-hidden />
            </Button>
          </span>
        ) : (
          <StatusChip tone={absenceStatusMeta[absence.status].tone}>{absenceStatusMeta[absence.status].label}</StatusChip>
        ),
    },
  ]

  const data = absences.data

  return (
    <>
      <PageHeader
        title="Novedades"
        description="Mientras dure una novedad el usuario no tiene turno: la app no deja iniciar jornada ni registra ubicación."
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              ariaLabel="Tipo de novedad"
              items={tabs}
              value={tab}
              onChange={(value) => {
                setTab(value)
                setPage(1)
              }}
            />
            <select aria-label="Estado" value={status} onChange={(event) => { setStatus(event.target.value as AbsenceStatus | ''); setPage(1) }} className={filterClass}>
              <option value="">Todos los estados</option>
              <option value="Pending">Pendientes</option>
              <option value="Approved">Aprobadas</option>
              <option value="Rejected">Rechazadas</option>
            </select>
          </div>

          <DataTable
            caption="Novedades"
            columns={columns}
            rows={data?.items}
            rowKey={(absence) => absence.id}
            loading={absences.isLoading}
            minWidth={640}
            error={absences.isError && !data ? <ErrorState message={errorMessage(absences.error)} onRetry={() => void absences.refetch()} /> : undefined}
            empty={
              <EmptyState
                icon={<Palmtree className="size-5" />}
                title="Sin novedades"
                description="Registra vacaciones, incapacidades, licencias, permisos o compensatorios con el formulario."
              />
            }
            footer={
              data && data.totalCount > 0 ? (
                <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} noun={['novedad', 'novedades']} />
              ) : undefined
            }
          />
        </div>

        <RegisterAbsenceForm />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={() => rejecting && decide(rejecting, 'reject')}
        loading={resolve.isPending}
        title="¿Rechazar la novedad?"
        confirmLabel="Rechazar"
        description={
          rejecting && (
            <>
              {absenceTypeLabel[rejecting.type]} de <strong>{rejecting.memberName}</strong> ({datesText(rejecting)}). La persona conserva
              su turno esos días.
            </>
          )
        }
      />
    </>
  )
}
