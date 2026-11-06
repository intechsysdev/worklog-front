import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Card, CardHeader, EmptyState, ErrorState, InlineMessage, ListSkeleton, PageHeader, Skeleton, Tag } from '@/components/ui/Primitives'
import { ApiError, errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { assignmentLevelLabel } from '@/lib/labels'
import type { Assignment, AssignmentLevel } from '@/lib/types'
import { capitalize, formatDayMonth, todayDateOnly } from '@/lib/utils'
import { useMemberOptions } from '@/features/members/api'
import { useBranches, useGroups } from '@/features/organization/api'
import { useAssignments, useCreateAssignment, useDeleteAssignment, useMemberCalendar, useTemplates } from '../api'
import { CalendarLegend, MonthCalendar } from '../components/MonthCalendar'
import { hoursText } from '../weekdays'

const targetMissing: Record<AssignmentLevel, string> = {
  Member: 'Elige la persona.',
  Group: 'Elige el grupo.',
  Branch: 'Elige la sede.',
}

const schema = z
  .object({
    level: z.enum(['Member', 'Group', 'Branch']),
    targetId: z.string(),
    templateId: z.string().min(1, 'Elige el horario.'),
    effectiveFrom: z.string().min(1, 'Elige la fecha de inicio.'),
  })
  .superRefine((values, context) => {
    if (!values.targetId) context.addIssue({ code: 'custom', path: ['targetId'], message: targetMissing[values.level] })
  })

type FormValues = z.infer<typeof schema>

const levelOrder: Record<AssignmentLevel, number> = { Member: 0, Group: 1, Branch: 2 }
const DAY_MS = 86_400_000

export default function AssignmentsPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Asignaciones y calendario"
        description="El turno de cada día sale de la novedad, el cambio puntual o la asignación más específica."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              setNotice(null)
              setFormOpen(true)
            }}
          >
            Nueva asignación
          </Button>
        }
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {formOpen && (
            <AssignmentForm
              onClose={() => setFormOpen(false)}
              onCreated={(message) => {
                setNotice(message)
                setFormOpen(false)
              }}
            />
          )}
          {notice && <InlineMessage tone="success">{notice}</InlineMessage>}
          <CurrentAssignments />
        </div>
        <CalendarPanel />
      </div>
    </>
  )
}

function AssignmentForm({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const create = useCreateAssignment()
  const members = useMemberOptions()
  const groups = useGroups()
  const branches = useBranches()
  const templates = useTemplates()

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { level: 'Member', targetId: '', templateId: '', effectiveFrom: todayDateOnly() },
  })

  const level = useWatch({ control, name: 'level' })

  const targets = useMemo(() => {
    if (level === 'Member')
      return (members.data ?? []).filter((member) => member.status !== 'Inactive').map((member) => ({ id: member.id, name: member.fullName, note: member.branchName }))
    if (level === 'Group') return (groups.data ?? []).filter((group) => group.isActive).map((group) => ({ id: group.id, name: group.name, note: group.branchName }))
    return (branches.data ?? []).filter((branch) => branch.status === 'Active').map((branch) => ({ id: branch.id, name: branch.name, note: branch.city }))
  }, [level, members.data, groups.data, branches.data])

  const usableTemplates = (templates.data ?? []).filter((template) => template.isActive && template.isCompliant)

  const submit = async (values: FormValues) => {
    try {
      const created = await create.mutateAsync({
        level: values.level,
        targetId: values.targetId,
        templateId: values.templateId,
        effectiveFrom: values.effectiveFrom,
      })
      onCreated(
        `Asignación creada: ${created.templateName} para ${created.targetName} desde el ${formatDayMonth(created.effectiveFrom)}. El calendario ya la usa.`,
      )
      toast.success('Asignación creada.')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'assignment.duplicate') {
        setError('effectiveFrom', { type: 'server', message: error.message })
        return
      }
      applyApiErrors(error, setError, ['level', 'targetId', 'templateId', 'effectiveFrom'])
    }
  }

  return (
    <Card className="border-2 border-accent-solid" aria-labelledby="new-assignment-title">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
        <h2 id="new-assignment-title" className="text-lg font-bold text-ink">
          Nueva asignación
        </h2>

        <FieldShell label="Aplica a">
          <ChipGroup<AssignmentLevel>
            ariaLabel="Aplica a"
            options={[
              { value: 'Member', label: 'Persona' },
              { value: 'Group', label: 'Grupo' },
              { value: 'Branch', label: 'Sede' },
            ]}
            value={level}
            onChange={(value) => {
              setValue('level', value)
              setValue('targetId', '')
            }}
          />
        </FieldShell>

        <Select label={assignmentLevelLabel[level]} required error={errors.targetId?.message} {...register('targetId')}>
          <option value="">{targetMissing[level].replace('.', '')}</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
              {target.note ? ` · ${target.note}` : ''}
            </option>
          ))}
        </Select>

        <Select
          label="Horario"
          required
          error={errors.templateId?.message}
          hint={usableTemplates.length === 0 && templates.isSuccess ? 'No hay plantillas válidas y activas. Créalas en Plantillas de horario.' : undefined}
          {...register('templateId')}
        >
          <option value="">Elige la plantilla</option>
          {usableTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · {template.summary}
            </option>
          ))}
        </Select>

        <Input label="Desde" type="date" required min={todayDateOnly()} error={errors.effectiveFrom?.message} {...register('effectiveFrom')} />

        <p className="text-[13px] leading-relaxed text-ink-muted">
          Gana la más específica: la de la persona sobre la de su grupo, y la del grupo sobre la de la sede. Las novedades y los
          cambios puntuales aprobados mandan sobre todas.
        </p>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Crear asignación
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CurrentAssignments() {
  const assignments = useAssignments()
  const remove = useDeleteAssignment()
  const [toDelete, setToDelete] = useState<Assignment | null>(null)
  const [now] = useState(() => Date.now())
  const today = todayDateOnly()

  const sorted = useMemo(
    () =>
      [...(assignments.data ?? [])].sort(
        (a, b) => levelOrder[a.level] - levelOrder[b.level] || a.targetName.localeCompare(b.targetName) || b.effectiveFrom.localeCompare(a.effectiveFrom),
      ),
    [assignments.data],
  )

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      await remove.mutateAsync(toDelete.id)
      toast.success('Asignación eliminada.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setToDelete(null)
    }
  }

  return (
    <Card padded={false} aria-labelledby="assignments-title">
      <CardHeader id="assignments-title" title="Asignaciones vigentes" className="px-5 pt-5 pb-3" />
      {assignments.isLoading ? (
        <ListSkeleton rows={3} />
      ) : assignments.isError ? (
        <ErrorState message={errorMessage(assignments.error)} onRetry={() => void assignments.refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={<CalendarRange className="size-5" />} title="Sin asignaciones" description="Asigna una plantilla a una sede, un grupo o una persona." />
      ) : (
        <ul className="flex flex-col pb-2">
          {sorted.map((assignment) => {
            const isNew = now - new Date(assignment.createdAt).getTime() < DAY_MS
            const pending = assignment.effectiveFrom > today
            return (
              <li key={assignment.id} className="flex items-start gap-3 border-t border-divider px-5 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                    {assignmentLevelLabel[assignment.level]}
                    {isNew && <Tag tone="accent">Nueva</Tag>}
                  </span>
                  <span className="font-semibold text-ink">{assignment.targetName}</span>
                  <span className="text-[13px] text-ink-soft">
                    {assignment.templateName} · {pending ? 'empieza' : 'desde'} el {formatDayMonth(assignment.effectiveFrom)}
                  </span>
                </div>
                {pending && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar la asignación de ${assignment.targetName}`}
                    title="Eliminar (aún no empieza)"
                    onClick={() => setToDelete(assignment)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={remove.isPending}
        title="¿Eliminar la asignación?"
        confirmLabel="Eliminar"
        description={
          toDelete && (
            <>
              <strong>{toDelete.targetName}</strong> dejará de tener «{toDelete.templateName}» desde el {formatDayMonth(toDelete.effectiveFrom)}.
              Solo se pueden eliminar las que aún no empiezan.
            </>
          )
        }
      />
    </Card>
  )
}

function CalendarPanel() {
  const [params, setParams] = useSearchParams()
  const members = useMemberOptions()
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })

  const people = (members.data ?? []).filter((member) => member.status !== 'Inactive')
  const fallback = people.find((member) => member.usage === 'Mobile') ?? people[0]
  const memberId = params.get('persona') ?? fallback?.id ?? null
  const calendar = useMemberCalendar(memberId, cursor.year, cursor.month)

  const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date(cursor.year, cursor.month - 1, 1))

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const date = new Date(year, month - 1 + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    })

  return (
    <Card className="flex min-w-0 flex-col gap-5" aria-labelledby="calendar-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Select
          label="Ver calendario de"
          value={memberId ?? ''}
          onChange={(event) => setParams({ persona: event.target.value }, { replace: true })}
          wrapperClassName="w-full max-w-xs"
          disabled={!people.length}
        >
          {people.length === 0 && <option value="">Sin personas</option>}
          {people.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
              {member.workGroupName ? ` · ${member.workGroupName}` : member.branchName ? ` · ${member.branchName}` : ''}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() + 1 })}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => move(1)}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 id="calendar-title" className="text-lg font-bold text-ink">
          {calendar.data?.memberName ?? 'Calendario'} · {monthLabel}
        </h2>
        {calendar.data && (
          <p className="text-sm text-ink-soft">
            <span className="tabular font-semibold">Programadas: {hoursText(calendar.data.scheduledMinutes)}</span>
            {calendar.data.sourceDescription && <> · Turno según: {calendar.data.sourceDescription}</>}
          </p>
        )}
      </div>

      <CalendarLegend />

      {members.isLoading || (calendar.isLoading && !!memberId) ? (
        <div className="grid grid-cols-7 gap-1.5" role="status" aria-label="Cargando calendario">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-[10px]" />
          ))}
        </div>
      ) : calendar.isError ? (
        <ErrorState message={errorMessage(calendar.error)} onRetry={() => void calendar.refetch()} />
      ) : !memberId ? (
        <EmptyState icon={<CalendarRange className="size-5" />} title="No hay personas para mostrar" description="Invita usuarios en Usuarios y roles." />
      ) : calendar.data ? (
        <div className={calendar.isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <MonthCalendar year={calendar.data.year} month={calendar.data.month} days={calendar.data.days} />
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {calendar.data ? `${capitalize(monthLabel)}: ${hoursText(calendar.data.scheduledMinutes)} programadas` : ''}
      </p>
    </Card>
  )
}
