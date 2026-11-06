import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Lock, LockOpen, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Card, EmptyState, ErrorState, InlineMessage, PageHeader, StatusChip, TableSkeleton } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { payrollMemberStatusMeta, requestTypeLabel } from '@/lib/labels'
import type { Breakdown, PayrollSummary } from '@/lib/types'
import { cn, formatDateTime, formatDayMonth, formatMinutes, todayDateOnly } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { useBranches } from '@/features/organization/api'
import { exportPeriod, useClosePeriod, usePayrollSummary, usePeriods, useReopenPeriod } from '../api'

const checklist = [
  { key: 'reviewedHourAlerts', label: 'Revisé las alertas de horas del equipo' },
  { key: 'reviewedAbsences', label: 'Revisé las novedades del periodo' },
  { key: 'resolvedRequests', label: 'Resolví las solicitudes pendientes' },
] as const

type ChecklistKey = (typeof checklist)[number]['key']

const columns: { key: keyof Breakdown; label: string }[] = [
  { key: 'ordinaryDay', label: 'Ord. diurnas' },
  { key: 'ordinaryNight', label: 'Ord. noct.' },
  { key: 'overtimeDay', label: 'Extra diurnas' },
  { key: 'overtimeNight', label: 'Extra noct.' },
  { key: 'sundayHoliday', label: 'Dom. y fest.' },
]

const hoursCell = (minutes: number) => (minutes ? formatMinutes(minutes) : '—')

export default function ClosingPage() {
  const { profile, can } = useAuth()
  const branches = useBranches()
  const activeBranches = (branches.data ?? []).filter((branch) => branch.status === 'Active')
  const [branchChoice, setBranchChoice] = useState<string | null>(null)
  const branchId = branchChoice ?? (activeBranches.find((branch) => branch.id === profile?.branchId) ?? activeBranches[0])?.id ?? null

  const periods = usePeriods(branchId)
  const [fromChoice, setFromChoice] = useState<string | null>(null)
  const from = fromChoice && periods.data?.some((period) => period.from === fromChoice) ? fromChoice : (periods.data?.[0]?.from ?? null)
  const summary = usePayrollSummary(branchId, from)
  const data = summary.data

  const branchName = activeBranches.find((branch) => branch.id === branchId)?.name

  return (
    <>
      <PageHeader
        title="Cierre de periodo"
        description={
          data
            ? `Quincena ${data.label} · Sede ${data.branchName} · ${data.status === 'Closed' ? 'cerrado' : data.canClose ? 'abierto, listo para revisar' : 'abierto'}`
            : branchName
              ? `Sede ${branchName}`
              : 'Revisa la quincena, resuelve lo pendiente y congela las horas para nómina.'
        }
        actions={
          <>
            <Select
              aria-label="Sede"
              value={branchId ?? ''}
              onChange={(event) => {
                setBranchChoice(event.target.value)
                setFromChoice(null)
              }}
              wrapperClassName="w-52"
            >
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Periodo" value={from ?? ''} onChange={(event) => setFromChoice(event.target.value)} wrapperClassName="w-56" disabled={!periods.data?.length}>
              {periods.data?.map((period) => (
                <option key={period.from} value={period.from}>
                  {period.label}
                  {period.status === 'Closed' ? ' (cerrado)' : ''}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {!branches.isLoading && activeBranches.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Receipt className="size-5" />} title="No hay sedes activas" description="El cierre se hace por sede. Crea o activa una en Organización." />
        </Card>
      ) : (
        <div className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_360px]">
          <PayrollTable summary={data} loading={summary.isLoading || periods.isLoading} error={summary.isError ? errorMessage(summary.error) : null} onRetry={() => void summary.refetch()} />
          {data && branchId && from && (
            <ClosePanel
              key={`${branchId}-${from}-${data.status}`}
              summary={data}
              branchId={branchId}
              from={from}
              canExport={can('export_payroll')}
              canClose={can('close_periods')}
              isAdmin={profile?.roleKey === 'admin'}
            />
          )}
        </div>
      )}
    </>
  )
}

function PayrollTable({ summary, loading, error, onRetry }: { summary?: PayrollSummary; loading: boolean; error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <Card padded={false}>
        <ErrorState message={error} onRetry={onRetry} />
      </Card>
    )
  }
  if (loading || !summary) {
    return (
      <Card padded={false}>
        <TableSkeleton columns={7} />
      </Card>
    )
  }
  if (summary.rows.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState icon={<Receipt className="size-5" />} title="Sin personas en este periodo" description="La sede no tiene personas con horas o novedades en esta quincena." />
      </Card>
    )
  }

  return (
    <section className="surface-card min-w-0 overflow-hidden" aria-label="Horas del periodo por persona">
      <div className="overflow-x-auto">
        <table className="rtable w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Horas de la quincena {summary.label}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-5 py-3 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                Usuario
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-2 py-3 text-right text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  {column.label}
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                Novedades
              </th>
              <th scope="col" className="px-5 py-3 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.memberId} className="border-t border-divider">
                <td className="px-5 py-3 font-semibold whitespace-nowrap text-ink">{row.name}</td>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label} className="tabular px-3 py-3 text-right text-ink-soft">
                    {hoursCell(row.hours[column.key])}
                  </td>
                ))}
                <td data-label="Novedades" className="px-3 py-3 text-[13px] text-ink-soft">
                  {row.absences ?? '—'}
                </td>
                <td data-label="Estado" className="px-5 py-3">
                  <StatusChip tone={payrollMemberStatusMeta[row.status].tone}>{payrollMemberStatusMeta[row.status].label}</StatusChip>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-line-strong bg-inset font-bold">
              <td className="px-5 py-3 text-ink">Total</td>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} className="tabular px-3 py-3 text-right text-ink">
                  {hoursCell(summary.totals[column.key])}
                </td>
              ))}
              <td className="px-3 py-3">
                <span className="sr-only">Sin novedades en el total</span>
              </td>
              <td className="px-5 py-3">
                <span className="sr-only">Sin estado en el total</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ClosePanel({
  summary,
  branchId,
  from,
  canExport,
  canClose,
  isAdmin,
}: {
  summary: PayrollSummary
  branchId: string
  from: string
  canExport: boolean
  canClose: boolean
  isAdmin: boolean
}) {
  const close = useClosePeriod()
  const reopen = useReopenPeriod()
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>({ reviewedHourAlerts: false, reviewedAbsences: false, resolvedRequests: false })
  const [confirm, setConfirm] = useState<'close' | 'reopen' | null>(null)
  const [exporting, setExporting] = useState<'Xlsx' | 'Csv' | null>(null)

  const allChecked = checklist.every((item) => checks[item.key])
  const pending = summary.pendingRequests

  const doClose = async () => {
    try {
      await close.mutateAsync({ branchId, from, body: checks })
      toast.success(`Periodo ${summary.label} cerrado. Las horas quedan congeladas.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  const doReopen = async () => {
    try {
      await reopen.mutateAsync({ branchId, from })
      toast.success(`Periodo ${summary.label} reabierto.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  const download = async (format: 'Xlsx' | 'Csv') => {
    setExporting(format)
    try {
      await exportPeriod(branchId, from, format)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  if (summary.status === 'Closed') {
    return (
      <Card as="aside" className="flex flex-col gap-4 self-start" aria-labelledby="closed-title">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-positive-soft text-positive" aria-hidden>
            <Lock className="size-5" />
          </span>
          <div>
            <h2 id="closed-title" className="text-lg font-bold text-ink">
              Periodo cerrado
            </h2>
            <p className="text-[13px] text-ink-muted">
              Por {summary.closedByName ?? '—'}
              {summary.closedAt && ` · ${formatDateTime(summary.closedAt)}`} · las horas quedan congeladas.
            </p>
          </div>
        </div>

        {canExport && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="section-label">Exportar para nómina</span>
            <div className="flex flex-wrap gap-2">
              <Button icon={<FileSpreadsheet className="size-4" aria-hidden />} loading={exporting === 'Xlsx'} onClick={() => void download('Xlsx')}>
                Excel (.xlsx)
              </Button>
              <Button icon={<FileText className="size-4" aria-hidden />} loading={exporting === 'Csv'} onClick={() => void download('Csv')}>
                CSV
              </Button>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="border-t border-line pt-4">
            <Button variant="danger" icon={<LockOpen className="size-4" aria-hidden />} onClick={() => setConfirm('reopen')}>
              Reabrir (solo administrador)
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={confirm === 'reopen'}
          onClose={() => setConfirm(null)}
          onConfirm={() => void doReopen()}
          loading={reopen.isPending}
          title="¿Reabrir el periodo?"
          confirmLabel="Reabrir periodo"
          description={
            <>
              La quincena <strong>{summary.label}</strong> vuelve a aceptar cambios. Si nómina ya la exportó, tendrá que exportarla de
              nuevo. Queda en la auditoría.
            </>
          }
        />
      </Card>
    )
  }

  return (
    <Card as="aside" className="flex flex-col gap-4 self-start" aria-labelledby="before-close-title">
      <h2 id="before-close-title" className="text-lg font-bold text-ink">
        Antes de cerrar
      </h2>

      {pending.length > 0 && (
        <InlineMessage tone="warning">
          <strong>
            {pending.length === 1 ? '1 solicitud de este periodo sigue pendiente' : `${pending.length} solicitudes de este periodo siguen pendientes`}
          </strong>{' '}
          ({pending.map((request) => `${request.memberName}, ${requestTypeLabel[request.type].toLowerCase()}`).join('; ')}).{' '}
          <Link to="/aprobaciones" className="font-semibold underline underline-offset-2">
            Ir a Aprobaciones
          </Link>
        </InlineMessage>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Lista de revisión obligatoria</legend>
        {checklist.map((item) => (
          <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-[10px] p-1 text-sm text-ink">
            <input
              type="checkbox"
              checked={checks[item.key]}
              onChange={(event) => setChecks((state) => ({ ...state, [item.key]: event.target.checked }))}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent-solid)]"
            />
            {item.label}
          </label>
        ))}
      </fieldset>

      <Button
        variant="primary"
        icon={<Lock className="size-4" aria-hidden />}
        disabled={!canClose || !allChecked || !summary.canClose}
        onClick={() => setConfirm('close')}
        aria-describedby="close-note"
      >
        Cerrar periodo
      </Button>
      <p id="close-note" className={cn('text-[13px] leading-relaxed', !summary.canClose ? 'text-caution' : 'text-ink-muted')}>
        {!canClose
          ? 'Tu rol no puede cerrar periodos.'
          : !summary.canClose
            ? pending.length > 0
              ? 'No se puede cerrar mientras haya solicitudes pendientes.'
              : summary.to >= todayDateOnly()
                ? `Se puede cerrar cuando termine la quincena (${formatDayMonth(summary.to)}).`
                : 'Este periodo todavía no se puede cerrar.'
            : 'Al cerrar, las horas quedan congeladas. Cualquier cambio posterior entra como ajuste en el periodo siguiente.'}
      </p>

      <ConfirmDialog
        open={confirm === 'close'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void doClose()}
        loading={close.isPending}
        tone="primary"
        title="¿Cerrar el periodo?"
        confirmLabel="Cerrar periodo"
        description={
          <>
            Se congelan las horas de <strong>{summary.label}</strong> en la sede {summary.branchName}. Solo un administrador puede
            reabrirlo.
          </>
        }
      />
    </Card>
  )
}
