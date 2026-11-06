import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Power, PowerOff, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup, Segmented } from '@/components/ui/Controls'
import { FieldShell, Select } from '@/components/ui/Field'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { Avatar, KeyValueList, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { memberStatusMeta, memberUsageLabel } from '@/lib/labels'
import type { Member, MemberUsage } from '@/lib/types'
import { formatDate, formatRelative } from '@/lib/utils'
import { useBranches, useGroups } from '@/features/organization/api'
import { useMemberOptions, useRoles, useSaveMember, useSetMemberActive, useUnlinkDevice } from '../api'
import { rolesForUsage } from '../roles'

const schema = z.object({
  usage: z.enum(['Mobile', 'WebOnly']),
  roleId: z.string().min(1, 'Elige el rol.'),
  branchId: z.string(),
  workGroupId: z.string(),
  supervisorId: z.string(),
})

type FormValues = z.infer<typeof schema>

function deviceText(member: Member) {
  if (member.usage === 'WebOnly') return 'Solo panel web'
  if (!member.deviceId) return 'Sin dispositivo vinculado'
  const model = member.deviceModel ?? member.deviceId
  return member.lastSeenAt ? `${model} · visto ${formatRelative(member.lastSeenAt)}` : model
}

export function MemberPanel({ member, open, onClose }: { member: Member | null; open: boolean; onClose: () => void }) {
  const save = useSaveMember()
  const setActive = useSetMemberActive()
  const unlink = useUnlinkDevice()
  const roles = useRoles()
  const branches = useBranches()
  const groups = useGroups()
  const people = useMemberOptions()
  const [confirm, setConfirm] = useState<'deactivate' | 'unlink' | null>(null)

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open || !member) return
    reset({
      usage: member.usage,
      roleId: member.roleId,
      branchId: member.branchId ?? '',
      workGroupId: member.workGroupId ?? '',
      supervisorId: member.supervisorId ?? '',
    })
  }, [open, member, reset])

  const usage = useWatch({ control, name: 'usage' }) ?? 'Mobile'
  const roleId = useWatch({ control, name: 'roleId' })
  const branchId = useWatch({ control, name: 'branchId' })

  if (!member) return null

  const roleOptions = rolesForUsage(roles.data ?? [], usage)
  const groupOptions = (groups.data ?? []).filter((group) => (group.isActive || group.id === member.workGroupId) && (!branchId || group.branchId === branchId))
  const supervisors = (people.data ?? []).filter((person) => person.id !== member.id && person.status !== 'Inactive')

  const submit = async (values: FormValues) => {
    try {
      await save.mutateAsync({
        id: member.id,
        command: {
          fullName: member.fullName,
          email: member.email,
          usage: values.usage,
          roleId: values.roleId,
          branchId: values.branchId || null,
          workGroupId: values.workGroupId || null,
          supervisorId: values.supervisorId || null,
        },
      })
      toast.success('Cambios guardados.')
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, ['usage', 'roleId', 'branchId', 'workGroupId', 'supervisorId'])
    }
  }

  const toggleActive = async (active: boolean) => {
    try {
      await setActive.mutateAsync({ id: member.id, active })
      toast.success(active ? `${member.fullName} está activo de nuevo.` : `${member.fullName} ya no puede entrar a WorkLog.`)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  const unlinkDevice = async () => {
    try {
      await unlink.mutateAsync(member.id)
      toast.success('Dispositivo desvinculado.')
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirm(null)
    }
  }

  const busy = isSubmitting || setActive.isPending || unlink.isPending
  const status = memberStatusMeta[member.status]

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        locked={busy}
        eyebrow="Editar usuario"
        title={
          <span className="flex items-center gap-3">
            <Avatar initials={member.initials} size="lg" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{member.fullName}</span>
              <span className="truncate text-sm font-normal text-ink-muted">{member.email}</span>
            </span>
          </span>
        }
        description={<StatusChip tone={status.tone}>{status.label}</StatusChip>}
        footer={
          <>
            <Button type="submit" form="member-form" variant="primary" loading={isSubmitting} disabled={!isDirty || busy}>
              Guardar
            </Button>
            {member.deviceId && (
              <Button icon={<Unlink className="size-4" aria-hidden />} disabled={busy} onClick={() => setConfirm('unlink')}>
                Desvincular dispositivo
              </Button>
            )}
            {member.status !== 'Inactive' ? (
              <Button variant="danger" icon={<PowerOff className="size-4" aria-hidden />} disabled={busy} onClick={() => setConfirm('deactivate')}>
                Desactivar usuario
              </Button>
            ) : (
              <Button icon={<Power className="size-4" aria-hidden />} loading={setActive.isPending} disabled={busy} onClick={() => void toggleActive(true)}>
                Activar usuario
              </Button>
            )}
          </>
        }
      >
        <form id="member-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
          <FieldShell label="Cómo usa WorkLog">
            <Segmented<MemberUsage>
              ariaLabel="Cómo usa WorkLog"
              items={[
                { id: 'Mobile', label: memberUsageLabel.Mobile },
                { id: 'WebOnly', label: memberUsageLabel.WebOnly },
              ]}
              value={usage}
              onChange={(value) => setValue('usage', value, { shouldDirty: true })}
            />
          </FieldShell>

          <FieldShell label="Rol" error={errors.roleId?.message}>
            <ChipGroup
              ariaLabel="Rol"
              invalid={!!errors.roleId}
              options={roleOptions.map((role) => ({ value: role.id, label: role.name }))}
              value={roleId}
              onChange={(value) => setValue('roleId', value, { shouldDirty: true, shouldValidate: true })}
            />
            {roleId && !roleOptions.some((role) => role.id === roleId) && (
              <p className="text-[13px] text-caution">Su rol actual no corresponde a este uso: elige otro.</p>
            )}
          </FieldShell>

          <Select label="Sede" error={errors.branchId?.message} {...register('branchId', { onChange: () => setValue('workGroupId', '') })}>
            <option value="">Sin sede</option>
            {branches.data
              ?.filter((branch) => branch.status === 'Active' || branch.id === member.branchId)
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

          <Select label="Supervisor" error={errors.supervisorId?.message} {...register('supervisorId')}>
            <option value="">Sin supervisor</option>
            {supervisors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName} · {person.roleName}
              </option>
            ))}
          </Select>

          <div className="rounded-[12px] bg-inset p-4">
            <KeyValueList
              items={[
                { label: 'Dispositivo', value: deviceText(member) },
                {
                  label: 'Política de datos',
                  value: member.policyVersion
                    ? `v${member.policyVersion} aceptada el ${formatDate(member.policyAcceptedAt)}`
                    : <span className="text-caution">Pendiente</span>,
                },
                { label: 'Última actividad', value: member.lastSeenAt ? formatRelative(member.lastSeenAt) : 'Nunca' },
                { label: 'Cuenta de ONE', value: member.isLinkedToOne ? 'Vinculada' : 'Aún no ingresa' },
              ]}
            />
          </div>

          <p className="text-[13px] leading-relaxed text-ink-muted">
            Los dispositivos, su grupo y su estado vienen de SOTI MobiControl. Desvincular cierra la sesión de WorkLog en ese
            dispositivo; lo que estaba en su cola sin sincronizar se pierde.
          </p>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirm === 'deactivate'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void toggleActive(false)}
        loading={setActive.isPending}
        title="¿Desactivar este usuario?"
        confirmLabel="Desactivar usuario"
        description={
          <>
            <strong>{member.fullName}</strong> no podrá entrar a WorkLog ni registrar jornadas. Su historial se conserva y puedes
            activarlo de nuevo cuando quieras.
          </>
        }
      />
      <ConfirmDialog
        open={confirm === 'unlink'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void unlinkDevice()}
        loading={unlink.isPending}
        title="¿Desvincular el dispositivo?"
        confirmLabel="Desvincular"
        description={
          <>
            Se cierra la sesión de WorkLog en <strong>{member.deviceModel ?? member.deviceId}</strong>. Lo que estaba en su cola sin
            sincronizar se pierde.
          </>
        }
      />
    </>
  )
}
