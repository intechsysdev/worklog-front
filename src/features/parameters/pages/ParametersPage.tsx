import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Lock, Pencil, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented, Stepper } from '@/components/ui/Controls'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { EmptyState, ErrorState, InlineMessage, KeyValueList, PageHeader, StatusChip, type ChipTone } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { countryName } from '@/lib/geo'
import type { ParameterLevel, ParameterRow } from '@/lib/types'
import { formatDayMonth, todayDateOnly } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { useBranches } from '@/features/organization/api'
import { useParameters, useResetParameter, useSetParameter } from '../api'

interface LevelOption {
  id: string
  level: ParameterLevel
  scope?: string
  label: string
  /** Nombre corto para "Editar en …" y "Aplica a …". */
  name: string
  readOnly: boolean
}

function formatValue(row: Pick<ParameterRow, 'unit'>, value: number) {
  if (row.unit === 'hora') return `${String(value).padStart(2, '0')}:00`
  return `${value} ${row.unit}`
}

export default function ParametersPage() {
  const { profile } = useAuth()
  const branches = useBranches()
  const platformAdmin = profile?.isPlatformAdmin ?? false

  const levels = useMemo<LevelOption[]>(() => {
    const countryCodes = Array.from(new Set(['CO', ...(branches.data ?? []).map((branch) => branch.countryCode)]))
    return [
      { id: 'global', level: 'Global', label: 'Global · producto', name: 'Global', readOnly: !platformAdmin },
      ...countryCodes.map<LevelOption>((code) => ({
        id: `country-${code}`,
        level: 'Country',
        scope: code,
        label: `País · ${countryName(code)}`,
        name: countryName(code),
        readOnly: !platformAdmin,
      })),
      { id: 'company', level: 'Company', label: `Empresa · ${profile?.tenantName ?? ''}`, name: 'la empresa', readOnly: false },
      ...(branches.data ?? [])
        .filter((branch) => branch.status === 'Active')
        .map<LevelOption>((branch) => ({
          id: `branch-${branch.id}`,
          level: 'Branch',
          scope: branch.id,
          label: `Sede · ${branch.name}`,
          name: `la sede ${branch.name}`,
          readOnly: false,
        })),
    ]
  }, [branches.data, platformAdmin, profile?.tenantName])

  const [levelId, setLevelId] = useState('company')
  const current = levels.find((option) => option.id === levelId) ?? levels.find((option) => option.id === 'company')!
  const parameters = useParameters(current.level, current.scope)
  const [editing, setEditing] = useState<ParameterRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sourceChip = (row: ParameterRow): { label: string; tone: ChipTone } => {
    if (row.definedHere) return { label: 'Este nivel', tone: 'accent' }
    switch (row.source) {
      case 'Global':
        return { label: 'Global', tone: 'neutral' }
      case 'Country':
        return { label: countryName(current.level === 'Branch' ? (branches.data?.find((b) => b.id === current.scope)?.countryCode ?? 'CO') : (current.scope ?? 'CO')), tone: 'neutral' }
      case 'Company':
        return { label: 'Empresa', tone: 'neutral' }
      case 'Branch':
        return { label: 'Sede', tone: 'neutral' }
      default:
        return { label: 'Predeterminado', tone: 'outline' }
    }
  }

  const columns: Column<ParameterRow>[] = [
    {
      key: 'name',
      header: 'Parámetro',
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{row.group}</span>
          <span className="font-semibold text-ink">{row.name}</span>
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Valor',
      render: (row) => (
        <span className="flex flex-col">
          <span className="tabular font-semibold text-ink">{formatValue(row, row.value)}</span>
          {row.effectiveFrom && <span className="text-[12px] text-ink-muted">desde el {formatDayMonth(row.effectiveFrom)}</span>}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Viene de',
      render: (row) => {
        const chip = sourceChip(row)
        return (
          <StatusChip tone={chip.tone} dot={false}>
            {chip.label}
          </StatusChip>
        )
      },
    },
    {
      key: 'action',
      header: 'Acción',
      align: 'right',
      render: (row) =>
        row.editable && !current.readOnly ? (
          <Button
            variant="tertiary"
            size="sm"
            icon={<Pencil className="size-3.5" aria-hidden />}
            aria-label={`Editar ${row.name}`}
            onClick={() => {
              setEditing(row)
              setDrawerOpen(true)
            }}
          >
            Editar
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Lock className="size-3.5" aria-hidden />
            {row.isLegal ? 'Se edita en el país' : current.readOnly ? 'Solo lectura' : 'Se edita en otro nivel'}
          </span>
        ),
    },
  ]

  const hint =
    current.level === 'Global'
      ? 'Valores del producto para todos los países y empresas.'
      : current.level === 'Country'
        ? 'Reglas laborales del país: las validan asesores y aplican a todas sus empresas.'
        : current.level === 'Company'
          ? 'Lo que definas aquí aplica a todas las sedes, salvo que una sede lo cambie.'
          : 'Solo aplica a esta sede. "Usar el heredado" vuelve al valor de la empresa.'

  return (
    <>
      <PageHeader
        title="Parámetros"
        description="Gana el valor del nivel más específico. Los cambios quedan en la auditoría."
        actions={
          profile && (
            <span className="text-sm text-ink-soft">
              Tu rol: <strong className="text-ink">{profile.roleName}</strong>
              {platformAdmin && ' · administrador de plataforma'}
            </span>
          )
        }
      />

      <div className="flex flex-col gap-2">
        <span className="section-label">Nivel que estás editando</span>
        <Segmented
          ariaLabel="Nivel"
          panelId="parameters-panel"
          items={levels.map((option) => ({
            id: option.id,
            label: (
              <>
                {option.readOnly && <Lock className="size-3 opacity-60" aria-hidden />}
                {option.label}
              </>
            ),
          }))}
          value={current.id}
          onChange={setLevelId}
          className="self-start"
        />
        <p className="text-[13px] text-ink-muted">{hint}</p>
        {current.readOnly && (
          <InlineMessage tone="info" className="max-w-2xl">
            Solo lectura: los niveles Global y País los administra INTECHSYS ONE. Puedes cambiarlos en tu empresa o en cada sede.
          </InlineMessage>
        )}
      </div>

      <div id="parameters-panel" role="tabpanel">
        <DataTable
          caption={`Parámetros · ${current.label}`}
          columns={columns}
          rows={parameters.data}
          rowKey={(row) => row.code}
          loading={parameters.isLoading}
          minWidth={720}
          error={parameters.isError ? <ErrorState message={errorMessage(parameters.error)} onRetry={() => void parameters.refetch()} /> : undefined}
          empty={<EmptyState icon={<SlidersHorizontal className="size-5" />} title="Sin parámetros en este nivel" />}
        />
      </div>

      <ParameterDrawer
        key={`${current.id}-${editing?.code ?? ''}`}
        open={drawerOpen}
        row={editing}
        level={current}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}

function ParameterDrawer({ open, row, level, onClose }: { open: boolean; row: ParameterRow | null; level: LevelOption; onClose: () => void }) {
  const setParameter = useSetParameter(level.level, level.scope)
  const reset = useResetParameter(level.level, level.scope)
  const [confirmReset, setConfirmReset] = useState(false)

  const schema = z
    .object({
      value: z.number(),
      effectiveFrom: z.string().min(1, 'Elige desde cuándo aplica.'),
      legalBasis: z.string().trim().max(250, 'Máximo 250 caracteres.'),
    })
    .superRefine((values, context) => {
      if (row?.isLegal && values.legalBasis.length < 3) {
        context.addIssue({ code: 'custom', path: ['legalBasis'], message: 'Escribe la norma o el soporte del cambio.' })
      }
    })
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { value: row?.value ?? 0, effectiveFrom: todayDateOnly(), legalBasis: row?.legalBasis ?? '' },
  })

  useEffect(() => {
    if (open && row) resetForm({ value: row.value, effectiveFrom: todayDateOnly(), legalBasis: '' })
  }, [open, row, resetForm])

  const value = useWatch({ control, name: 'value' })
  const effectiveFrom = useWatch({ control, name: 'effectiveFrom' })

  if (!row) return null

  const inheritedLabel = row.definedHere ? 'Valor actual' : `Heredado de ${row.source ? (row.source === 'Company' ? 'la empresa' : row.source === 'Country' ? 'el país' : row.source === 'Global' ? 'Global' : 'la sede') : 'el producto'}`

  const submit = async (values: FormValues) => {
    try {
      await setParameter.mutateAsync({
        code: row.code,
        command: { value: values.value, effectiveFrom: values.effectiveFrom || null, legalBasis: values.legalBasis.trim() || null },
      })
      toast.success(`${row.name}: ${formatValue(row, values.value)} desde el ${formatDayMonth(values.effectiveFrom)}.`)
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, ['value', 'effectiveFrom', 'legalBasis'])
    }
  }

  const applyInherited = async () => {
    try {
      await reset.mutateAsync(row.code)
      toast.success(`${row.name} vuelve a usar el valor heredado.`)
      setConfirmReset(false)
      onClose()
    } catch (error) {
      setConfirmReset(false)
      toast.error(errorMessage(error))
    }
  }

  const busy = isSubmitting || reset.isPending

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        locked={busy}
        eyebrow={`Editar en ${level.name}`}
        title={row.name}
        description={row.help}
        footer={
          <>
            <Button type="submit" form="parameter-form" variant="primary" loading={isSubmitting} disabled={busy}>
              Guardar
            </Button>
            {row.definedHere && (
              <Button disabled={busy} onClick={() => setConfirmReset(true)}>
                Usar el heredado
              </Button>
            )}
          </>
        }
      >
        <form id="parameter-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
          <div className="rounded-[12px] bg-inset p-4">
            <KeyValueList
              items={[
                { label: inheritedLabel, value: formatValue(row, row.value) },
                { label: 'Rango permitido', value: `${formatValue(row, row.min)} a ${formatValue(row, row.max)}` },
                ...(row.legalBasis ? [{ label: 'Norma vigente', value: row.legalBasis }] : []),
              ]}
            />
          </div>

          <Stepper
            label="Nuevo valor"
            value={value}
            onChange={(next) => setValue('value', next, { shouldDirty: true })}
            step={row.step}
            min={row.min}
            max={row.max}
            format={(current) => formatValue(row, current)}
          />
          {errors.value?.message && (
            <p role="alert" className="-mt-3 text-[13px] text-critical">
              {errors.value.message}
            </p>
          )}

          <Input label="Aplica desde" type="date" required error={errors.effectiveFrom?.message} {...register('effectiveFrom')} />

          {row.isLegal && (
            <Input
              label={
                <>
                  Norma o soporte del cambio <span className="font-normal text-ink-muted">(obligatorio)</span>
                </>
              }
              placeholder="Ej.: Ley 2466 de 2025, art. 14"
              error={errors.legalBasis?.message}
              {...register('legalBasis')}
            />
          )}

          <p className="text-[13px] leading-relaxed text-ink-muted">
            {value === row.value
              ? 'El valor no cambia.'
              : `Desde el ${effectiveFrom ? formatDayMonth(effectiveFrom) : '…'}, ${level.name} usará ${formatValue(row, value)} en lugar de ${formatValue(row, row.value)}. Los registros anteriores no se recalculan.`}
          </p>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void applyInherited()}
        loading={reset.isPending}
        tone="primary"
        title="¿Usar el valor heredado?"
        confirmLabel="Usar el heredado"
        description={
          <>
            Se borra el valor de <strong>{row.name}</strong> en {level.name} y vuelve a regir el del nivel superior.
          </>
        }
      />
    </>
  )
}
