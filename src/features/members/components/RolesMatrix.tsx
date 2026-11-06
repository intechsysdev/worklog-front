import { Fragment, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, Skeleton } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { roleKindLabel } from '@/lib/labels'
import type { PermissionInfo, Role } from '@/lib/types'
import { cn, normalize } from '@/lib/utils'
import { useCreateRole, usePermissionCatalog, useRoles, useSetRolePermissions } from '../api'
import { isAdminRole } from '../roles'

/** Matriz Permiso × Rol (§1, Usuarios y roles). La columna del Administrador va bloqueada. */
export function RolesMatrix() {
  const roles = useRoles()
  const catalog = usePermissionCatalog()
  const setPermissions = useSetRolePermissions()
  const [creating, setCreating] = useState(false)

  if (roles.isLoading || catalog.isLoading) {
    return (
      <div className="surface-card flex flex-col gap-3 p-5" role="status" aria-label="Cargando permisos">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
    )
  }

  if (roles.isError || catalog.isError) {
    return (
      <div className="surface-card">
        <ErrorState
          message={errorMessage(roles.error ?? catalog.error)}
          onRetry={() => {
            void roles.refetch()
            void catalog.refetch()
          }}
        />
      </div>
    )
  }

  const roleList = roles.data ?? []
  const permissions = catalog.data ?? []
  const groups = permissions.reduce<Record<string, PermissionInfo[]>>((acc, permission) => {
    ;(acc[permission.group] ??= []).push(permission)
    return acc
  }, {})

  const toggle = (role: Role, key: string) => {
    const has = role.permissions.includes(key)
    const next = has ? role.permissions.filter((item) => item !== key) : [...role.permissions, key]
    const permission = permissions.find((item) => item.key === key)
    setPermissions.mutate(
      { id: role.id, permissions: next },
      {
        onSuccess: () => toast.success(`${role.name}: ${has ? 'sin' : 'con'} «${permission?.name ?? key}».`, { duration: 2500 }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  return (
    <section className="surface-card flex flex-col overflow-hidden" aria-labelledby="matrix-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="matrix-title" className="text-lg font-bold text-ink">
            Roles y permisos
          </h2>
          <p className="text-sm text-ink-muted">Cada cambio se aplica al instante y queda en la auditoría.</p>
        </div>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
          Nuevo rol
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Permisos por rol</caption>
          <thead>
            <tr>
              <th scope="col" className="px-5 py-3 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                Permiso
              </th>
              {roleList.map((role) => (
                <th
                  key={role.id}
                  scope="col"
                  aria-label={`${role.name} · ${roleKindLabel[role.kind]} · ${role.people} ${role.people === 1 ? "persona" : "personas"}`}
                  className="px-2 py-3 text-center align-bottom"
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                      {isAdminRole(role) && <Lock className="size-3 text-ink-muted" aria-hidden />}
                      {role.name}
                    </span>
                    <span className="text-[11px] font-normal text-ink-muted">
                      {roleKindLabel[role.kind]} · {role.people} {role.people === 1 ? 'persona' : 'personas'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([group, items]) => (
              <Fragment key={group}>
                <tr className="bg-inset">
                  <th scope="colgroup" colSpan={roleList.length + 1} className="section-label px-5 py-2 text-left">
                    {group}
                  </th>
                </tr>
                {items.map((permission) => (
                  <tr key={permission.key} className="border-t border-divider">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      <span className="block font-semibold text-ink">{permission.name}</span>
                      <span className="block text-[12px] text-ink-muted">{permission.description}</span>
                    </th>
                    {roleList.map((role) => {
                      const on = role.permissions.includes(permission.key)
                      const locked = isAdminRole(role)
                      return (
                        <td key={role.id} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            aria-pressed={on}
                            aria-disabled={locked || undefined}
                            aria-label={`${permission.name} para ${role.name}${locked ? ' (bloqueado)' : ''}`}
                            title={locked ? 'El administrador tiene todos los permisos y no se puede limitar.' : undefined}
                            onClick={() => !locked && toggle(role, permission.key)}
                            className={cn(
                              'inline-flex size-9 items-center justify-center rounded-[10px] border transition-colors',
                              locked
                                ? 'cursor-not-allowed border-transparent bg-ink-soft text-canvas'
                                : on
                                  ? 'border-accent-solid bg-accent-solid text-white hover:bg-accent-hover'
                                  : 'border-line-strong bg-raised text-transparent hover:border-ink-subtle',
                            )}
                          >
                            <Check className="size-4" strokeWidth={3} aria-hidden />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-muted">
        El administrador tiene todos los permisos y no se puede limitar. Cada cambio de permisos queda en la auditoría.
      </p>

      <CreateRoleDialog open={creating} onClose={() => setCreating(false)} roles={roleList} />
    </section>
  )
}

function CreateRoleDialog({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const create = useCreateRole()
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(3, 'El nombre necesita más de 2 caracteres.')
      .max(60, 'Máximo 60 caracteres.')
      .refine((name) => !roles.some((role) => normalize(role.name) === normalize(name)), 'Ya existe un rol con ese nombre.'),
    copyFromRoleId: z.string(),
  })
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', copyFromRoleId: '' } })

  const close = () => {
    onClose()
    reset()
  }

  const submit = async (values: FormValues) => {
    try {
      const role = await create.mutateAsync({ name: values.name.trim(), copyFromRoleId: values.copyFromRoleId || null })
      toast.success(`Rol «${role.name}» creado.`)
      close()
    } catch (error) {
      applyApiErrors(error, setError, ['name', 'copyFromRoleId'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      locked={isSubmitting}
      width="sm"
      title="Nuevo rol"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" variant="primary" loading={isSubmitting}>
            Crear rol
          </Button>
        </>
      }
    >
      <form id="role-form" className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Input label="Nombre" required placeholder="Ej.: Coordinador de campo" error={errors.name?.message} {...register('name')} />
        <Select label="Copiar permisos de" error={errors.copyFromRoleId?.message} {...register('copyFromRoleId')}>
          <option value="">Empezar sin permisos</option>
          {roles
            .filter((role) => !isAdminRole(role))
            .map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
        </Select>
      </form>
    </Modal>
  )
}
