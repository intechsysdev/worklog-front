import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Battery, Check, Lock, RefreshCw, Save, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Switch } from '@/components/ui/Field'
import { Card, CardHeader, EmptyState, ErrorState, InlineMessage, ListSkeleton, PageHeader, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import type { DeviceControlSettings, DeviceRow, OfflinePolicy, Verification } from '@/lib/types'
import { cn, formatClock, formatDateTime, formatRelative } from '@/lib/utils'
import { useBranches, useGroups } from '@/features/organization/api'
import { useParameters } from '@/features/parameters/api'
import { useDeviceApps, useDeviceSettings, useDevices, useSaveDeviceSettings, useVerifyDeviceControl } from '../api'
import { appName } from '../apps'

const WARNING_OPTIONS = [30, 15, 10, 5]

const schema = z
  .object({
    enabled: z.boolean(),
    scope: z.array(z.string()),
    warningMinutes: z.array(z.number()),
    logoutSharedOnClose: z.boolean(),
    offlinePolicy: z.enum(['AllowAndNotify', 'Block']),
    corporateApps: z.array(z.string()),
  })
  .superRefine((values, context) => {
    if (!values.enabled) return
    if (values.scope.length === 0) context.addIssue({ code: 'custom', path: ['scope'], message: 'Elige al menos una sede o grupo.' })
    if (values.warningMinutes.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['warningMinutes'],
        message: 'Deja al menos un aviso antes del cierre: es la única forma de que el usuario guarde su trabajo a tiempo.',
      })
  })

type FormValues = z.infer<typeof schema>

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Alcance: "b:<id>" para sedes y "g:<id>" para grupos, en un solo grupo de chips como en el diseño. */
const toScope = (settings: DeviceControlSettings) => [...settings.branchIds.map((id) => `b:${id}`), ...settings.groupIds.map((id) => `g:${id}`)]

export default function DeviceControlPage() {
  const settings = useDeviceSettings()

  if (settings.isLoading) {
    return (
      <>
        <PageHeader title="Control de dispositivos" description="Apps corporativas solo en jornada, con SOTI MobiControl." />
        <div className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-56 rounded-[16px]" />
            <Skeleton className="h-72 rounded-[16px]" />
          </div>
          <Skeleton className="h-96 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (settings.isError || !settings.data) {
    return (
      <>
        <PageHeader title="Control de dispositivos" />
        <Card padded={false}>
          <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()} />
        </Card>
      </>
    )
  }

  return <DeviceControlForm settings={settings.data} />
}

function DeviceControlForm({ settings }: { settings: DeviceControlSettings }) {
  const save = useSaveDeviceSettings()
  const verify = useVerifyDeviceControl()
  const branches = useBranches()
  const groups = useGroups()
  const apps = useDeviceApps()
  const [verification, setVerification] = useState<Verification | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const {
    handleSubmit,
    setValue,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: settings.enabled,
      scope: toScope(settings),
      warningMinutes: settings.warningMinutes,
      logoutSharedOnClose: settings.logoutSharedOnClose,
      offlinePolicy: settings.offlinePolicy,
      corporateApps: settings.corporateApps,
    },
  })

  const values = useWatch({ control }) as FormValues
  const passed = verification ? verification.passed : settings.lastVerificationPassed

  // Avisar antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const fixed = settings.fixedApps
  const catalog = useMemo(() => {
    const all = new Set([...(apps.data ?? []), ...settings.corporateApps, ...settings.alwaysAvailableApps, ...fixed])
    return Array.from(all)
  }, [apps.data, settings, fixed])
  const corporate = values.corporateApps.filter((pkg) => !fixed.includes(pkg))
  const always = catalog.filter((pkg) => !corporate.includes(pkg))

  // Vista previa con los parámetros de la primera sede del alcance (o de la empresa).
  const previewBranchId = values.scope.find((item) => item.startsWith('b:'))?.slice(2)
  const parameters = useParameters(previewBranchId ? 'Branch' : 'Company', previewBranchId)
  const param = (code: string, fallback: number) => parameters.data?.find((row) => row.code === code)?.value ?? fallback
  const early = param('ant', 15)
  const grace = param('gra', 10)
  const shiftStart = 7 * 60
  const shiftEnd = 16 * 60
  const warnings = [...values.warningMinutes].sort((a, b) => b - a)
  const previewBranch = branches.data?.find((branch) => branch.id === previewBranchId)?.name

  const runVerify = () =>
    verify.mutate(undefined, {
      onSuccess: (result) => {
        setVerification(result)
        toast[result.passed ? 'success' : 'warning'](result.passed ? 'Todo listo en MobiControl.' : 'Hay puntos pendientes en MobiControl.')
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  const submit = async (form: FormValues) => {
    setSaved(null)
    try {
      const result = await save.mutateAsync({
        enabled: form.enabled,
        branchIds: form.scope.filter((item) => item.startsWith('b:')).map((item) => item.slice(2)),
        groupIds: form.scope.filter((item) => item.startsWith('g:')).map((item) => item.slice(2)),
        warningMinutes: form.warningMinutes,
        logoutSharedOnClose: form.logoutSharedOnClose,
        offlinePolicy: form.offlinePolicy,
        corporateApps: form.corporateApps.filter((pkg) => !fixed.includes(pkg)),
        alwaysAvailableApps: always,
      })
      reset({ ...form, scope: toScope(result), corporateApps: result.corporateApps })
      const message = form.enabled
        ? 'Guardado. WorkLog empezará a enviar órdenes a MobiControl en los próximos minutos. Queda en Auditoría.'
        : 'Guardado. La opción está apagada: los dispositivos no cambian.'
      setSaved(message)
      toast.success('Control de dispositivos guardado.')
    } catch (error) {
      applyApiErrors(error, setError, ['enabled', 'scope', 'warningMinutes', 'logoutSharedOnClose', 'offlinePolicy', 'corporateApps'], {
        branchIds: 'scope',
        groupIds: 'scope',
      })
    }
  }

  const toggleIn = (list: string[], item: string) => (list.includes(item) ? list.filter((value) => value !== item) : [...list, item])
  const scopeOptions = [
    ...(branches.data ?? []).filter((branch) => branch.status === 'Active').map((branch) => ({ value: `b:${branch.id}`, label: branch.name })),
    ...(groups.data ?? []).filter((group) => group.isActive).map((group) => ({ value: `g:${group.id}`, label: `Grupo ${group.name}` })),
  ]
  const checks = verification?.checks

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
      <PageHeader
        title="Control de dispositivos"
        description="Con SOTI MobiControl, las apps corporativas solo se ven mientras la jornada está abierta. Fuera de jornada el dispositivo queda en kiosco con WorkLog y el teléfono."
        actions={
          <Button type="submit" variant="primary" icon={<Save className="size-4" aria-hidden />} loading={isSubmitting} disabled={!isDirty}>
            Guardar cambios
          </Button>
        }
      />

      {(errors.scope || errors.warningMinutes) && (
        <InlineMessage tone="error">{errors.scope?.message ?? errors.warningMinutes?.message}</InlineMessage>
      )}
      {saved && !isDirty && <InlineMessage tone="success">{saved}</InlineMessage>}

      <div className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-5" aria-labelledby="dc-main-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="dc-main-title" className="text-lg font-bold text-ink">
                  Apps corporativas solo en jornada
                </h2>
                <p className="mt-1 text-sm text-ink-muted">Aplica a dispositivos compartidos (Shared Device) y asignados a una persona.</p>
              </div>
              <Switch
                checked={values.enabled}
                disabled={!values.enabled && !passed}
                ariaLabel="Apps corporativas solo en jornada"
                onChange={(checked) => setValue('enabled', checked, { shouldDirty: true })}
              />
            </div>
            {!values.enabled && !passed && (
              <InlineMessage tone="warning">No se puede encender hasta que la verificación de MobiControl pase completa.</InlineMessage>
            )}

            <div className="flex flex-col gap-2 rounded-[12px] bg-inset p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold', passed ? 'text-positive' : 'text-caution')}>
                  {checks
                    ? passed
                      ? 'Todo listo en MobiControl'
                      : `${checks.filter((check) => !check.passed).length} punto${checks.filter((check) => !check.passed).length === 1 ? '' : 's'} pendiente${checks.filter((check) => !check.passed).length === 1 ? '' : 's'}`
                    : passed
                      ? 'La última verificación pasó'
                      : 'La última verificación no pasó'}
                  {settings.lastVerifiedAt && !checks && (
                    <span className="font-normal text-ink-muted"> · {formatDateTime(settings.lastVerifiedAt)}</span>
                  )}
                </span>
                <Button size="sm" icon={<RefreshCw className={cn('size-3.5', verify.isPending && 'animate-spin')} aria-hidden />} disabled={verify.isPending} onClick={runVerify}>
                  {checks ? 'Verificar de nuevo' : 'Verificar ahora'}
                </Button>
              </div>
              {checks && (
                <ul className="flex flex-col gap-2 pt-1" aria-live="polite">
                  {checks.map((check) => (
                    <li key={check.code} className="flex items-start gap-2.5 text-sm">
                      <span
                        className={cn(
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                          check.passed ? 'bg-positive-soft text-positive' : 'bg-caution-soft text-caution',
                        )}
                        aria-hidden
                      >
                        {check.passed ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                      </span>
                      <span>
                        <strong className="font-semibold text-ink">{check.name}</strong>
                        <span className="block text-[13px] text-ink-muted">{check.detail}</span>
                      </span>
                      <span className="sr-only">{check.passed ? 'correcto' : 'pendiente'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-5" aria-labelledby="dc-rules-title">
            <h2 id="dc-rules-title" className="text-lg font-bold text-ink">
              Reglas
            </h2>
            <FieldShell label="Sedes y grupos donde aplica" error={errors.scope?.message}>
              <ChipGroup
                multiple
                ariaLabel="Sedes y grupos donde aplica"
                invalid={!!errors.scope}
                options={scopeOptions}
                value={values.scope}
                onChange={(item) => setValue('scope', toggleIn(values.scope, item), { shouldDirty: true, shouldValidate: !!errors.scope })}
              />
            </FieldShell>
            <FieldShell label="Avisos antes del cierre" error={errors.warningMinutes?.message}>
              <ChipGroup
                multiple
                ariaLabel="Avisos antes del cierre"
                invalid={!!errors.warningMinutes}
                options={WARNING_OPTIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))}
                value={values.warningMinutes.map(String)}
                onChange={(item) =>
                  setValue('warningMinutes', toggleIn(values.warningMinutes.map(String), item).map(Number), {
                    shouldDirty: true,
                    shouldValidate: !!errors.warningMinutes,
                  })
                }
              />
            </FieldShell>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Gracia después del fin del turno', value: grace ? `${grace} min` : 'Sin gracia' },
                { label: 'Puede iniciar antes del turno', value: `${early} min` },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-[12px] border border-line p-3">
                  <span className="text-[13px] font-semibold text-ink-soft">{item.label}</span>
                  <span className="tabular text-[15px] font-semibold text-ink">{parameters.isLoading ? '…' : item.value}</span>
                  <Link to="/parametros" className="text-[12px] font-semibold text-accent hover:underline">
                    Se cambia en Parámetros{previewBranch ? ` · sede ${previewBranch}` : ''}
                  </Link>
                </div>
              ))}
            </div>

            <InlineMessage tone="info">
              Ejemplo con turno {hhmm(shiftStart)} – {hhmm(shiftEnd)}: se puede iniciar desde las {hhmm(shiftStart - early)}
              {warnings.length ? `; avisos a las ${warnings.map((minutes) => hhmm(shiftEnd + grace - minutes)).join(' y ')}` : '; sin avisos'}; cierre a las{' '}
              {hhmm(shiftEnd + grace)}. Con horas extra autorizadas, el cierre se corre hasta su fin.
            </InlineMessage>

            <Switch
              checked={values.logoutSharedOnClose}
              onChange={(checked) => setValue('logoutSharedOnClose', checked, { shouldDirty: true })}
              label="En dispositivos compartidos, cerrar la sesión de Shared Device al cerrar la jornada"
              description="Así el siguiente usuario no ve los datos de la persona anterior."
            />

            <FieldShell label="Si MobiControl no responde al iniciar la jornada">
              <ChipGroup<OfflinePolicy>
                ariaLabel="Si MobiControl no responde al iniciar la jornada"
                options={[
                  { value: 'AllowAndNotify', label: 'Dejar iniciar la jornada y avisar al administrador' },
                  { value: 'Block', label: 'No dejar iniciar hasta que MobiControl responda' },
                ]}
                value={values.offlinePolicy}
                onChange={(value) => setValue('offlinePolicy', value, { shouldDirty: true })}
              />
            </FieldShell>
          </Card>

          <Card className="flex flex-col gap-4" aria-labelledby="dc-apps-title">
            <CardHeader
              id="dc-apps-title"
              title="Apps del dispositivo"
              description="Lista leída del catálogo de apps de MobiControl. WorkLog y Teléfono siempre están disponibles."
            />
            {apps.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <AppColumn
                  title={`Solo en jornada · ${corporate.length}`}
                  apps={corporate}
                  empty="Ninguna app se oculta fuera de jornada."
                  action={(pkg) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Mover ${appName(pkg)} a siempre disponibles`}
                      onClick={() => setValue('corporateApps', values.corporateApps.filter((item) => item !== pkg), { shouldDirty: true })}
                    >
                      Mover <ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  )}
                />
                <AppColumn
                  title="Siempre disponibles"
                  apps={always}
                  fixed={fixed}
                  action={(pkg) =>
                    fixed.includes(pkg) ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-ink-muted">
                        <Lock className="size-3" aria-hidden /> Fija
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Mover ${appName(pkg)} a solo en jornada`}
                        onClick={() => setValue('corporateApps', [...values.corporateApps, pkg], { shouldDirty: true })}
                      >
                        <ArrowLeft className="size-3.5" aria-hidden /> Mover
                      </Button>
                    )
                  }
                />
              </div>
            )}
          </Card>
        </div>

        <DevicesNow />
      </div>
    </form>
  )
}

function AppColumn({
  title,
  apps,
  fixed = [],
  empty,
  action,
}: {
  title: string
  apps: string[]
  fixed?: string[]
  empty?: string
  action: (pkg: string) => ReactNode
}) {
  const sorted = [...apps].sort((a, b) => Number(fixed.includes(b)) - Number(fixed.includes(a)) || appName(a).localeCompare(appName(b)))
  return (
    <section className="flex flex-col gap-2 rounded-[12px] border border-line p-3" aria-label={title}>
      <h3 className="section-label px-1">{title}</h3>
      {sorted.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {sorted.map((pkg) => (
            <li key={pkg} className="flex items-center justify-between gap-2 border-t border-divider px-1 py-2 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-ink">{appName(pkg)}</span>
                <span className="truncate font-mono text-[11px] text-ink-muted">{pkg}</span>
              </span>
              {action(pkg)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const commandStatus: Record<string, { label: string; className: string }> = {
  Applied: { label: 'Aplicada', className: 'text-positive' },
  Queued: { label: 'En cola · sin conexión', className: 'text-caution' },
  Failed: { label: 'Falló', className: 'text-critical' },
}

function DevicesNow() {
  const devices = useDevices()

  return (
    <Card as="aside" padded={false} className="flex flex-col self-start" aria-labelledby="devices-now-title">
      <div className="px-5 pt-5 pb-3">
        <h2 id="devices-now-title" className="text-lg font-bold text-ink">
          Dispositivos ahora
        </h2>
      </div>
      {devices.isLoading ? (
        <ListSkeleton rows={4} />
      ) : devices.isError ? (
        <ErrorState message={errorMessage(devices.error)} onRetry={() => void devices.refetch()} />
      ) : !devices.data?.length ? (
        <EmptyState icon={<Smartphone className="size-5" />} title="Sin dispositivos inscritos" description="Aparecen cuando MobiControl los inscribe." />
      ) : (
        <ul className="flex max-h-[640px] flex-col overflow-y-auto">
          {devices.data.map((device) => (
            <DeviceItem key={device.deviceId} device={device} />
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1 border-t border-line px-5 py-3 text-[13px]">
        <Link to="/auditoria" className="font-semibold text-accent hover:underline">
          Ver órdenes en Auditoría
        </Link>
      </div>
    </Card>
  )
}

function DeviceItem({ device }: { device: DeviceRow }) {
  const status = device.lastCommandStatus ? commandStatus[device.lastCommandStatus] : null
  const lowBattery = device.batteryPercent != null && device.batteryPercent <= 15
  return (
    <li className="flex flex-col gap-1 border-t border-divider px-5 py-3 text-sm first:border-t-0">
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-ink">{device.memberName ?? (device.isShared ? 'Compartido' : 'Sin usuario')}</span>
        <StatusChip tone={device.isShared ? 'neutral' : 'outline'} dot={false}>
          {device.isShared ? 'Compartido' : 'Asignado'}
        </StatusChip>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-soft">
        {device.model}
        <span className={cn('inline-flex items-center gap-1', device.online ? 'text-ink-muted' : 'font-semibold text-caution')}>
          · {device.online ? 'en línea' : `sin conexión ${device.lastSeenAt ? formatRelative(device.lastSeenAt) : ''}`}
        </span>
        {device.batteryPercent != null && (
          <span className={cn('inline-flex items-center gap-1', lowBattery ? 'font-semibold text-caution' : 'text-ink-muted')}>
            <Battery className="size-3.5" aria-hidden /> {device.batteryPercent}%
          </span>
        )}
      </span>
      <span className="text-[13px] text-ink-muted">
        Jornada {device.workdayOpen ? 'abierta' : 'cerrada'}
        {device.workdaySince && ` · desde ${formatClock(device.workdaySince)}`}
      </span>
      {status && (
        <span className="text-[13px] text-ink-muted">
          Orden a MobiControl: <span className={cn('font-semibold', status.className)}>{status.label}</span>
          {device.lastCommandAt && ` · ${formatClock(device.lastCommandAt)}`}
        </span>
      )}
    </li>
  )
}
