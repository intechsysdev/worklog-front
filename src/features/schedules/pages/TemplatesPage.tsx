import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, Check, Clock, Plus, Power, PowerOff, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Stepper } from '@/components/ui/Controls'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Card, EmptyState, ErrorState, InlineMessage, ListSkeleton, PageHeader, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import type { CheckSeverity, SaveTemplateCommand, ScheduleTemplate } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'
import { previewTemplate, useSaveTemplate, useSetTemplateActive, useTemplates } from '../api'
import { daysToFlags, hoursText, lettersToDays, minutesToTime, timeToMinutes, toTimeOnly, weekDays, type DayLetter } from '../weekdays'

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la plantilla.').max(80, 'Máximo 80 caracteres.'),
  days: z.array(z.string()).min(1, 'Elige al menos un día.'),
  start: z.number(),
  end: z.number(),
  lunch: z.number(),
})

type FormValues = z.infer<typeof schema>

type Selection = { kind: 'template'; id: string } | { kind: 'new' } | null

function templateUse(template: ScheduleTemplate) {
  if (!template.isActive) return 'Inactiva'
  if (template.people > 0) return `${template.people} ${template.people === 1 ? 'persona' : 'personas'} · ${template.assignments} ${template.assignments === 1 ? 'asignación' : 'asignaciones'}`
  if (template.assignments > 0) return `${template.assignments} ${template.assignments === 1 ? 'asignación' : 'asignaciones'}, sin personas aún`
  return 'Sin asignar'
}

export default function TemplatesPage() {
  const templates = useTemplates()
  const [selection, setSelection] = useState<Selection>(null)

  const list = templates.data ?? []
  const effective: Selection = selection ?? (list[0] ? { kind: 'template', id: list[0].id } : templates.isSuccess ? { kind: 'new' } : null)
  const selected = effective?.kind === 'template' ? (list.find((template) => template.id === effective.id) ?? null) : null

  return (
    <>
      <PageHeader
        title="Plantillas de horario"
        description="Cada plantilla se valida con los topes legales vigentes antes de guardarse."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setSelection({ kind: 'new' })}>
            Nueva plantilla
          </Button>
        }
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-[320px_minmax(0,1fr)]">
        <Card padded={false} className="self-start" aria-label="Plantillas">
          {templates.isLoading ? (
            <ListSkeleton />
          ) : templates.isError ? (
            <ErrorState message={errorMessage(templates.error)} onRetry={() => void templates.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={<Clock className="size-5" />} title="Aún no hay plantillas" description="Crea la primera con el editor de la derecha." />
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {list.map((template) => {
                const active = selected?.id === template.id
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelection({ kind: 'template', id: template.id })}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-[12px] border-2 px-3 py-2.5 text-left transition-colors',
                        active ? 'border-accent-solid bg-accent-soft' : 'border-transparent hover:bg-inset',
                        !template.isActive && 'opacity-75',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{template.name}</span>
                        <StatusChip tone={template.isCompliant ? 'positive' : 'critical'}>
                          {template.isCompliant ? 'Válida' : 'No cumple'}
                        </StatusChip>
                      </span>
                      <span className="tabular text-[13px] text-ink-soft">{template.summary}</span>
                      <span className="text-[13px] text-ink-muted">{templateUse(template)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {effective && (
          <TemplateEditor
            key={effective.kind === 'template' ? effective.id : 'new'}
            template={selected}
            onSaved={(template) => setSelection({ kind: 'template', id: template.id })}
          />
        )}
      </div>
    </>
  )
}

const severityIcon: Record<CheckSeverity, { icon: typeof Check; className: string; label: string }> = {
  Pass: { icon: Check, className: 'bg-positive-soft text-positive', label: 'Cumple' },
  Warning: { icon: AlertTriangle, className: 'bg-caution-soft text-caution', label: 'Aviso' },
  Fail: { icon: X, className: 'bg-critical-soft text-critical', label: 'No cumple' },
}

function TemplateEditor({ template, onSaved }: { template: ScheduleTemplate | null; onSaved: (template: ScheduleTemplate) => void }) {
  const isNew = !template
  const save = useSaveTemplate()
  const setActive = useSetTemplateActive()
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template?.name ?? '',
      days: template ? lettersToDays(template.dayLetters) : ['L', 'M', 'X', 'J', 'V'],
      start: template ? timeToMinutes(template.startTime) : 7 * 60,
      end: template ? timeToMinutes(template.endTime) : 16 * 60,
      lunch: template?.lunchMinutes ?? 60,
    },
  })

  const values = useWatch({ control })
  const days = (values.days ?? []) as DayLetter[]

  const command: SaveTemplateCommand = {
    name: values.name?.trim() || 'Vista previa',
    days: daysToFlags(days),
    startTime: toTimeOnly(values.start ?? 0),
    endTime: toTimeOnly(values.end ?? 0),
    lunchMinutes: values.lunch ?? 0,
  }
  // Se compara como texto: un objeto nuevo en cada render reiniciaría el retardo sin fin.
  const debounced = JSON.parse(useDebounced(JSON.stringify(command), 250)) as SaveTemplateCommand

  // Validación en vivo con el mismo motor que usará el guardado.
  const preview = useQuery({
    queryKey: ['template-preview', debounced.days, debounced.startTime, debounced.endTime, debounced.lunchMinutes],
    queryFn: ({ signal }) => previewTemplate(debounced, signal),
    enabled: days.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })

  const compliant = days.length > 0 && preview.data?.isCompliant === true && !preview.isPlaceholderData
  const nameMissing = !values.name?.trim()
  const blocked = !compliant || nameMissing

  const toggleDay = (letter: DayLetter) => {
    const next = days.includes(letter) ? days.filter((day) => day !== letter) : [...days, letter]
    setValue('days', next, { shouldDirty: true, shouldValidate: isSubmitted })
  }

  const submit = async (form: FormValues) => {
    if (!compliant) {
      toast.error('Corrige lo que no cumple antes de guardar.')
      return
    }
    try {
      const saved = await save.mutateAsync({
        id: template?.id,
        command: { ...command, name: form.name.trim() },
      })
      toast.success(isNew ? 'Plantilla creada. Ya se puede usar en Asignaciones.' : 'Plantilla guardada.')
      onSaved(saved)
    } catch (error) {
      applyApiErrors(error, setError, ['name', 'days', 'start', 'end', 'lunch'], {
        startTime: 'start',
        endTime: 'end',
        lunchMinutes: 'lunch',
      })
    }
  }

  const toggleActive = async (active: boolean) => {
    if (!template) return
    try {
      await setActive.mutateAsync({ id: template.id, active })
      toast.success(active ? 'Plantilla activada.' : 'Plantilla desactivada.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirmDeactivate(false)
    }
  }

  const saveNote = nameMissing
    ? 'Escribe el nombre de la plantilla.'
    : !compliant
      ? 'Corrige lo que no cumple para poder guardar.'
      : 'Aplica a nuevas asignaciones desde la fecha que elijas.'

  return (
    <Card className="flex min-w-0 flex-col gap-6" aria-label={isNew ? 'Nueva plantilla' : `Plantilla ${template.name}`}>
      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit(submit)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">{isNew ? 'Nueva plantilla' : template.name}</h2>
          {template && !template.isActive && <StatusChip tone="neutral">Inactiva</StatusChip>}
        </div>

        <Input label="Nombre" required placeholder="Ej.: Turno tarde L–V" error={errors.name?.message} wrapperClassName="max-w-md" {...register('name')} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold text-ink-soft">Días de trabajo</legend>
          <div className="flex flex-wrap gap-2">
            {weekDays.map((day) => {
              const on = days.includes(day.letter)
              return (
                <button
                  key={day.letter}
                  type="button"
                  aria-pressed={on}
                  aria-label={day.label}
                  title={day.label}
                  onClick={() => toggleDay(day.letter)}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-[10px] border text-[15px] font-bold transition-colors',
                    on ? 'border-accent-solid bg-accent-solid text-white' : 'border-line-strong bg-raised text-ink-soft hover:border-ink-subtle',
                  )}
                >
                  {day.letter}
                </button>
              )
            })}
          </div>
          {errors.days?.message && (
            <p role="alert" className="text-[13px] text-critical">
              {errors.days.message}
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stepper
            label="Entrada"
            value={values.start ?? 0}
            onChange={(value) => setValue('start', value, { shouldDirty: true })}
            step={30}
            min={0}
            max={23 * 60 + 30}
            format={minutesToTime}
          />
          <Stepper
            label="Salida"
            value={values.end ?? 0}
            onChange={(value) => setValue('end', value, { shouldDirty: true })}
            step={30}
            min={0}
            max={23 * 60 + 30}
            format={minutesToTime}
          />
          <Stepper
            label="Almuerzo"
            value={values.lunch ?? 0}
            onChange={(value) => setValue('lunch', value, { shouldDirty: true })}
            step={30}
            min={0}
            max={120}
            format={(value) => `${value} min`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Horas por día', value: preview.data ? hoursText(preview.data.dailyMinutes) : null },
            { label: 'Horas por semana', value: preview.data ? hoursText(preview.data.weeklyMinutes) : null },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-[12px] bg-inset p-4">
              <span className="text-[13px] text-ink-muted">{item.label}</span>
              {item.value ? <span className="tabular text-2xl font-bold text-ink">{item.value}</span> : <Skeleton className="h-8 w-16" />}
            </div>
          ))}
        </div>

        <section aria-labelledby="checks-title" aria-live="polite" className="flex flex-col gap-2">
          <h3 id="checks-title" className="section-label">
            Validaciones
          </h3>
          {days.length === 0 ? (
            <InlineMessage tone="warning">Elige al menos un día de trabajo.</InlineMessage>
          ) : preview.isError ? (
            <InlineMessage tone="error">{errorMessage(preview.error)}</InlineMessage>
          ) : !preview.data ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : (
            <ul className={cn('flex flex-col gap-2 transition-opacity', preview.isFetching && 'opacity-60')}>
              {preview.data.checks.map((check) => {
                const meta = severityIcon[check.severity]
                const Icon = meta.icon
                return (
                  <li key={check.code} className="flex items-start gap-2.5 text-sm">
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', meta.className)} aria-hidden>
                      <Icon className="size-3" strokeWidth={3} />
                    </span>
                    <span className="text-ink-soft">
                      <strong className="font-semibold text-ink">{meta.label}</strong> · {check.message}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={blocked} aria-describedby="template-save-note">
            Guardar plantilla
          </Button>
          <span id="template-save-note" className={cn('text-[13px]', blocked ? 'text-caution' : 'text-ink-muted')}>
            {saveNote}
          </span>
          {template?.isActive && (
            <Button variant="danger" className="ml-auto" icon={<PowerOff className="size-4" aria-hidden />} onClick={() => setConfirmDeactivate(true)}>
              Desactivar
            </Button>
          )}
          {template && !template.isActive && (
            <Button className="ml-auto" icon={<Power className="size-4" aria-hidden />} loading={setActive.isPending} onClick={() => void toggleActive(true)}>
              Activar
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => void toggleActive(false)}
        loading={setActive.isPending}
        title="¿Desactivar la plantilla?"
        confirmLabel="Desactivar plantilla"
        description={
          <>
            <strong>{template?.name}</strong> no se podrá usar en nuevas asignaciones. Las asignaciones que ya la usan no cambian.
          </>
        }
      />
    </Card>
  )
}
