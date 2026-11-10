import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, MailCheck, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { InlineMessage, KeyValueList } from '@/components/ui/Primitives'
import { ApiError, errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { memberUsageLabel } from '@/lib/labels'
import type { Member, MemberUsage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBranches, useGroups } from '@/features/organization/api'
import { useAssignDevice } from '@/features/devices/api'
import { DevicePicker } from './DevicePicker'
import { useMemberOptions, useRoles, useSaveMember } from '../api'
import { rolesForUsage } from '../roles'
import { SecretBox } from './SecretBox'

const schema = z.object({
  fullName: z.string().trim().min(3, 'Escribe el nombre completo.').max(120, 'Máximo 120 caracteres.'),
  email: z.string().trim().min(1, 'Escribe el correo corporativo.').email('Escribe un correo válido, p. ej. nombre@empresa.com.'),
  usage: z.enum(['Mobile', 'WebOnly']),
  roleId: z.string().min(1, 'Elige el rol.'),
  branchId: z.string(),
  workGroupId: z.string(),
  supervisorId: z.string(),
  usesPanel: z.boolean(),
})

type FormValues = z.infer<typeof schema>
const stepOneFields = ['fullName', 'email', 'usage'] as const
const allFields = [...stepOneFields, 'roleId', 'branchId', 'workGroupId', 'supervisorId'] as const

const defaults: FormValues = { fullName: '', email: '', usage: 'Mobile', roleId: '', branchId: '', workGroupId: '', supervisorId: '', usesPanel: false }

const steps = ['Datos', 'Rol y sede', 'Dispositivo']

/** Asistente de invitación (§1, Invitar usuario). El paso de dispositivo llega con la integración de MobiControl. */
export function InviteDialog({ open, onClose, onViewUsers }: { open: boolean; onClose: () => void; onViewUsers: () => void }) {
  const [step, setStep] = useState(0)
  const [invited, setInvited] = useState<Member | null>(null)
  /** '' = asignar después. */
  const [deviceId, setDeviceId] = useState('')
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null)
  const assignDevice = useAssignDevice()
  const save = useSaveMember()
  const roles = useRoles()
  const branches = useBranches()
  const groups = useGroups()
  const people = useMemberOptions()

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    setError,
    reset,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  const usage = useWatch({ control, name: 'usage' })
  const roleId = useWatch({ control, name: 'roleId' })
  const branchId = useWatch({ control, name: 'branchId' })

  const roleOptions = rolesForUsage(roles.data ?? [], usage)
  const groupOptions = (groups.data ?? []).filter((group) => group.isActive && (!branchId || group.branchId === branchId))
  const supervisors = (people.data ?? []).filter((person) => person.status !== 'Inactive')

  const restart = () => {
    reset(defaults)
    setInvited(null)
    setDeviceId('')
    setDeviceWarning(null)
    setStep(0)
  }

  const close = () => {
    if (isSubmitting) return
    onClose()
    // Se limpia al terminar la animación de salida.
    window.setTimeout(restart, 250)
  }

  const next = async () => {
    if (step === 0 && (await trigger([...stepOneFields]))) setStep(1)
    else if (step === 1 && (await trigger(['roleId', 'branchId', 'workGroupId', 'supervisorId']))) setStep(2)
  }

  const submit = async (values: FormValues) => {
    try {
      const member = await save.mutateAsync({
        command: {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          usage: values.usage,
          roleId: values.roleId,
          branchId: values.branchId || null,
          workGroupId: values.workGroupId || null,
          supervisorId: values.supervisorId || null,
          usesPanel: values.usage === 'Mobile' ? values.usesPanel : null,
        },
      })
      // El dispositivo se vincula después de crear a la persona; si falla, la invitación sigue en pie.
      if (values.usage === 'Mobile' && deviceId) {
        try {
          await assignDevice.mutateAsync({ memberId: member.id, deviceId })
        } catch (error) {
          setDeviceWarning(`La invitación se envió, pero el dispositivo no se pudo vincular: ${errorMessage(error)} Vincúlalo desde Usuarios y roles.`)
        }
      }
      setInvited(member)
    } catch (error) {
      applyApiErrors(error, setError, allFields)
      // El correo duplicado se corrige en el primer paso.
      if (error instanceof ApiError && error.fieldErrors && Object.keys(error.fieldErrors).some((key) => /email|fullName/i.test(key))) setStep(0)
      else if (error instanceof ApiError && error.fieldErrors) setStep(1)
    }
  }

  if (invited) {
    // Campos que la API solo envía en la respuesta de invitar: contraseña de la app y alta de la cuenta en ONE.
    const oneResult = invited as typeof invited & {
      oneAccountCreated?: boolean | null
      temporaryPassword?: string | null
      oneNotice?: string | null
      appTemporaryPassword?: string | null
    }
    return (
      <Modal
        open={open}
        onClose={close}
        title="Invitación enviada"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={restart}>
              Invitar a otra persona
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onViewUsers()
                close()
              }}
            >
              Ver usuarios
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive" aria-hidden>
              <MailCheck className="size-5" />
            </span>
            <p className="pt-1.5 text-sm leading-relaxed text-ink-soft">
              <strong className="text-ink">{invited.fullName}</strong> quedó como <strong>Invitado</strong>. Pasa a Activo cuando
              {invited.usage === 'Mobile'
                ? ` entre a la app con su correo (${invited.email}) y la contraseña temporal.`
                : ` ingrese al panel con su cuenta de INTECHSYS ONE (${invited.email}).`}
              {invited.usage === 'Mobile' && !deviceWarning && (deviceId ? ' El dispositivo quedó vinculado.' : ' No podrá iniciar jornada hasta tener dispositivo.')}
            </p>
          </div>
          {deviceWarning && <InlineMessage tone="warning">{deviceWarning}</InlineMessage>}
          {oneResult.oneNotice && <InlineMessage tone="warning">{oneResult.oneNotice}</InlineMessage>}
          {oneResult.appTemporaryPassword && (
            <SecretBox
              title="Contraseña de la app"
              description="Entrégale su correo y esta contraseña temporal por un canal seguro. Solo se muestra ahora; la app le pedirá cambiarla al entrar."
              value={oneResult.appTemporaryPassword}
            />
          )}
          {oneResult.temporaryPassword && (
            <SecretBox
              title={invited.usage === 'Mobile' ? 'Cuenta del panel en INTECHSYS ONE' : 'Cuenta creada en INTECHSYS ONE'}
              description="Contraseña temporal para entrar al panel web. Solo se muestra ahora; ONE le pedirá cambiarla en el primer ingreso."
              value={oneResult.temporaryPassword}
            />
          )}
          {oneResult.oneAccountCreated === false && (
            <InlineMessage tone="info">Ya tenía cuenta en INTECHSYS ONE: quedó vinculada a la empresa con su contraseña de siempre.</InlineMessage>
          )}
          <div className="rounded-[12px] bg-inset p-4">
            <h3 className="section-label mb-2">Qué pasa después</h3>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              {invited.usage === 'Mobile' ? (
                <>
                  <li>SOTI MobiControl instala WorkLog en su dispositivo.</li>
                  <li>Entra a la app con su correo y la contraseña temporal, y crea la suya.</li>
                  <li>Acepta la política de datos.</li>
                </>
              ) : (
                <li>No necesita dispositivo: entra al panel con su cuenta de INTECHSYS ONE.</li>
              )}
              <li>Pasa a Activo y todo queda en la auditoría.</li>
            </ol>
          </div>
        </div>
      </Modal>
    )
  }

  const values = getValues()

  return (
    <Modal
      open={open}
      onClose={close}
      locked={isSubmitting}
      width="md"
      title="Invitar usuario"
      description="La persona entra con su cuenta de INTECHSYS ONE; aquí defines qué puede hacer en WorkLog."
      footer={
        step === 0 ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void next()}>
              Siguiente
            </Button>
          </>
        ) : step === 1 ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setStep(0)}>
              Atrás
            </Button>
            <Button variant="primary" onClick={() => void next()}>
              Siguiente
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setStep(1)} disabled={isSubmitting}>
              Atrás
            </Button>
            <Button type="submit" form="invite-form" variant="primary" loading={isSubmitting}>
              Enviar invitación
            </Button>
          </>
        )
      }
    >
      <ol className="mb-5 flex items-center gap-2" aria-label="Pasos">
        {steps.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={index === step ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                index < step && 'bg-positive-soft text-positive',
                index === step && 'bg-accent-solid text-white',
                index > step && 'bg-segmented text-ink-muted',
              )}
            >
              {index < step ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className={cn('text-sm', index === step ? 'font-semibold text-ink' : 'text-ink-muted')}>{label}</span>
            {index < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>

      <form
        id="invite-form"
        className="flex flex-col gap-5"
        noValidate
        onSubmit={
          step < 2
            ? (event) => {
                // Enter en los primeros pasos avanza; solo el último envía la invitación.
                event.preventDefault()
                void next()
              }
            : handleSubmit(submit)
        }
      >
        {step === 0 ? (
          <>
            <Input label="Nombre completo" required autoComplete="off" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Correo corporativo" required type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
            <FieldShell label="Cómo usará WorkLog">
              <div role="radiogroup" aria-label="Cómo usará WorkLog" className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { value: 'Mobile', icon: Smartphone, text: 'Registra su jornada en la app del dispositivo.' },
                    { value: 'WebOnly', icon: Monitor, text: 'Solo entra al panel web: supervisión o administración.' },
                  ] as const
                ).map((option) => {
                  const selected = usage === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setValue('usage', option.value as MemberUsage)
                        setValue('roleId', '')
                      }}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-[12px] p-4 text-left transition-colors',
                        selected ? 'border-2 border-accent-solid bg-accent-soft' : 'border border-line hover:border-line-strong',
                      )}
                    >
                      <option.icon className={cn('size-5', selected ? 'text-accent' : 'text-ink-muted')} aria-hidden />
                      <span className="font-semibold text-ink">{memberUsageLabel[option.value]}</span>
                      <span className="text-[13px] text-ink-muted">{option.text}</span>
                    </button>
                  )
                })}
              </div>
            </FieldShell>
            {usage === 'Mobile' && (
              <label className="flex items-start gap-2.5 text-sm text-ink-soft">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent-solid)]" {...register('usesPanel')} />
                <span>
                  <span className="font-semibold text-ink">También entra al panel web</span>
                  <span className="block text-[13px] text-ink-muted">
                    Para supervisores de campo: se crea además su cuenta de INTECHSYS ONE. La app siempre usa la contraseña de WorkLog.
                  </span>
                </span>
              </label>
            )}
          </>
        ) : step === 1 ? (
          <>
            <div className="rounded-[12px] bg-inset p-4">
              <KeyValueList
                items={[
                  { label: 'Persona', value: values.fullName },
                  { label: 'Correo', value: values.email },
                  { label: 'Uso', value: memberUsageLabel[values.usage] },
                ]}
              />
            </div>

            <FieldShell label="Rol" error={errors.roleId?.message} required>
              <ChipGroup
                ariaLabel="Rol"
                invalid={!!errors.roleId}
                options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
                value={roleId}
                onChange={(value) => setValue('roleId', value, { shouldValidate: true })}
              />
            </FieldShell>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Sede" error={errors.branchId?.message} {...register('branchId', { onChange: () => setValue('workGroupId', '') })}>
                <option value="">Sin sede</option>
                {branches.data
                  ?.filter((branch) => branch.status === 'Active')
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </Select>
              <Select label="Grupo" error={errors.workGroupId?.message} {...register('workGroupId')}>
                <option value="">Sin grupo</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>

            <Select label="Supervisor" error={errors.supervisorId?.message} {...register('supervisorId')}>
              <option value="">Sin supervisor</option>
              {supervisors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} · {person.roleName}
                </option>
              ))}
            </Select>

            <p className="text-[13px] text-ink-muted">El horario se asigna en Asignaciones.</p>
          </>
        ) : null}
        {step === 2 &&
          (usage === 'Mobile' ? (
            <DevicePicker value={deviceId} onChange={setDeviceId} />
          ) : (
            <InlineMessage tone="info">
              Este usuario solo usará el panel web, así que no necesita dispositivo. Entrará con su cuenta de INTECHSYS ONE.
            </InlineMessage>
          ))}
      </form>
    </Modal>
  )
}
