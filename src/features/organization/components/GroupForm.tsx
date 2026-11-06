import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import type { WorkGroup } from '@/lib/types'
import { useMemberOptions } from '@/features/members/api'
import { useTemplates } from '@/features/schedules/api'
import { useAuth } from '@/providers/AuthProvider'
import { useBranches, useSaveGroup, useSetGroupActive } from '../api'

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del grupo (mínimo 2 caracteres).').max(120, 'Máximo 120 caracteres.'),
  branchId: z.string().min(1, 'Elige la sede.'),
  supervisorId: z.string(),
  defaultTemplateId: z.string(),
  mdmGroupPath: z.string().trim().max(200, 'Máximo 200 caracteres.'),
})

type FormValues = z.infer<typeof schema>
const fields = ['name', 'branchId', 'supervisorId', 'defaultTemplateId', 'mdmGroupPath'] as const

export function GroupForm({ group, open, onClose }: { group: WorkGroup | null; open: boolean; onClose: () => void }) {
  const isNew = !group
  const { can } = useAuth()
  const save = useSaveGroup()
  const setActive = useSetGroupActive()
  const branches = useBranches()
  const templates = useTemplates()
  const members = useMemberOptions(can(['manage_users', 'view_team', 'manage_schedules', 'manage_settings']))
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset({
      name: group?.name ?? '',
      branchId: group?.branchId ?? '',
      supervisorId: group?.supervisorId ?? '',
      defaultTemplateId: group?.defaultTemplateId ?? '',
      mdmGroupPath: group?.mdmGroupPath ?? '',
    })
  }, [open, group, reset])

  // Supervisores posibles: cualquier persona no desactivada (y el actual, aunque lo esté).
  const supervisors = (members.data ?? []).filter((member) => member.status !== 'Inactive' || member.id === group?.supervisorId)

  const submit = async (values: FormValues) => {
    try {
      const saved = await save.mutateAsync({
        id: group?.id,
        command: {
          name: values.name.trim(),
          branchId: values.branchId,
          supervisorId: values.supervisorId || null,
          defaultTemplateId: values.defaultTemplateId || null,
          mdmGroupPath: values.mdmGroupPath.trim() || null,
        },
      })
      toast.success(isNew ? `Grupo «${saved.name}» creado.` : 'Cambios guardados.')
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, fields)
    }
  }

  const toggleActive = async (active: boolean) => {
    if (!group) return
    try {
      await setActive.mutateAsync({ id: group.id, active })
      toast.success(active ? 'Grupo activado.' : 'Grupo desactivado.')
      setConfirmDeactivate(false)
      onClose()
    } catch (error) {
      setConfirmDeactivate(false)
      toast.error(errorMessage(error))
    }
  }

  const busy = isSubmitting || setActive.isPending

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        locked={busy}
        eyebrow={isNew ? 'Nuevo grupo' : 'Editar grupo'}
        title={isNew ? 'Crear grupo' : group.name}
        description={
          group && <StatusChip tone={group.isActive ? 'positive' : 'neutral'}>{group.isActive ? 'Activo' : 'Inactivo'}</StatusChip>
        }
        footer={
          <>
            <Button type="submit" form="group-form" variant="primary" loading={isSubmitting}>
              {isNew ? 'Crear grupo' : 'Guardar'}
            </Button>
            {group?.isActive && (
              <Button variant="danger" icon={<PowerOff className="size-4" aria-hidden />} disabled={busy} onClick={() => setConfirmDeactivate(true)} className="ml-auto">
                Desactivar
              </Button>
            )}
            {group && !group.isActive && (
              <Button icon={<Power className="size-4" aria-hidden />} loading={setActive.isPending} disabled={busy} onClick={() => void toggleActive(true)} className="ml-auto">
                Activar
              </Button>
            )}
          </>
        }
      >
        <form id="group-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
          <Input label="Nombre" required placeholder="Ej.: Instalaciones" error={errors.name?.message} {...register('name')} />

          <Select label="Sede" required error={errors.branchId?.message} {...register('branchId')}>
            <option value="">Elige la sede</option>
            {branches.data
              ?.filter((branch) => branch.status === 'Active' || branch.id === group?.branchId)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </Select>

          <Select
            label="Supervisor"
            error={errors.supervisorId?.message}
            hint={members.isError ? 'Tu rol no puede listar personas: deja el supervisor como está.' : undefined}
            {...register('supervisorId')}
          >
            <option value="">Sin asignar</option>
            {supervisors.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} · {member.roleName}
              </option>
            ))}
            {group?.supervisorId && !supervisors.some((member) => member.id === group.supervisorId) && (
              <option value={group.supervisorId}>{group.supervisorName ?? 'Supervisor actual'}</option>
            )}
          </Select>

          <Select label="Horario por defecto" error={errors.defaultTemplateId?.message} {...register('defaultTemplateId')}>
            <option value="">Sin horario por defecto</option>
            {templates.data
              ?.filter((template) => template.isActive || template.id === group?.defaultTemplateId)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.summary}
                </option>
              ))}
          </Select>

          <Input
            label="Grupo MobiControl"
            placeholder="INTECHSYS / Campo / Medellín"
            hint="Ruta del grupo en SOTI MobiControl. Sirve para sugerir el grupo al invitar. Déjalo vacío si el grupo es solo de panel web."
            error={errors.mdmGroupPath?.message}
            {...register('mdmGroupPath')}
          />
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => void toggleActive(false)}
        loading={setActive.isPending}
        title="¿Desactivar el grupo?"
        confirmLabel="Desactivar grupo"
        description={
          <>
            <strong>{group?.name}</strong> dejará de estar disponible para invitar personas y asignar horarios.
          </>
        }
      />
    </>
  )
}
