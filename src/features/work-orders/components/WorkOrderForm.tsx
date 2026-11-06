import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Drawer } from '@/components/ui/Modal'
import { StatusChip } from '@/components/ui/Primitives'
import { applyApiErrors } from '@/lib/forms'
import { workOrderStatusMeta } from '@/lib/labels'
import type { ActivityType, Member, WorkOrder, WorkSite } from '@/lib/types'
import { formatClock, todayDateOnly } from '@/lib/utils'
import { useSaveWorkOrder } from '../api'

const schema = z.object({
  number: z.string().trim().min(1, 'Escribe el número de la OT.').max(40, 'Máximo 40 caracteres.'),
  activityTypeId: z.string().min(1, 'Elige la actividad.'),
  workSiteId: z.string(),
  assigneeId: z.string(),
  scheduledDate: z.string().min(1, 'Elige la fecha programada.'),
  scheduledTime: z.string(),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres.'),
})

type FormValues = z.infer<typeof schema>
const fields = ['number', 'activityTypeId', 'workSiteId', 'assigneeId', 'scheduledDate', 'scheduledTime', 'notes'] as const

export function WorkOrderForm({
  open,
  order,
  activities,
  sites,
  members,
  onClose,
}: {
  open: boolean
  order: WorkOrder | null
  activities: ActivityType[]
  sites: WorkSite[]
  members: Member[]
  onClose: () => void
}) {
  const isNew = !order
  const save = useSaveWorkOrder()
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
      number: order?.number ?? '',
      activityTypeId: order?.activityTypeId ?? '',
      workSiteId: order?.workSiteId ?? '',
      assigneeId: order?.assigneeId ?? '',
      scheduledDate: order?.scheduledDate ?? todayDateOnly(),
      scheduledTime: order?.scheduledTime ? formatClock(order.scheduledTime) : '',
      notes: order?.notes ?? '',
    })
  }, [open, order, reset])

  const submit = async (values: FormValues) => {
    try {
      const saved = await save.mutateAsync({
        id: order?.id,
        command: {
          number: values.number.trim(),
          activityTypeId: values.activityTypeId,
          workSiteId: values.workSiteId || null,
          assigneeId: values.assigneeId || null,
          scheduledDate: values.scheduledDate,
          scheduledTime: values.scheduledTime ? `${values.scheduledTime}:00` : null,
          notes: values.notes.trim() || null,
        },
      })
      toast.success(isNew ? `OT ${saved.number} creada.` : `OT ${saved.number} guardada.`)
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, fields)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      locked={isSubmitting}
      eyebrow={isNew ? 'Nueva orden de trabajo' : 'Editar orden de trabajo'}
      title={isNew ? 'Crear OT' : order.number}
      description={order && <StatusChip tone={workOrderStatusMeta[order.status].tone}>{workOrderStatusMeta[order.status].label}</StatusChip>}
      footer={
        <>
          <Button type="submit" form="work-order-form" variant="primary" loading={isSubmitting}>
            {isNew ? 'Crear OT' : 'Guardar'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="work-order-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
        <Input label="Número" required placeholder="Ej.: OT-1052" autoComplete="off" error={errors.number?.message} {...register('number')} />

        <Select label="Actividad" required error={errors.activityTypeId?.message} {...register('activityTypeId')}>
          <option value="">Elige la actividad</option>
          {activities
            .filter((activity) => activity.isActive || activity.id === order?.activityTypeId)
            .map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
        </Select>

        <Select label="Sitio" error={errors.workSiteId?.message} hint="Opcional. Con sitio, la app valida la geocerca." {...register('workSiteId')}>
          <option value="">Sin sitio</option>
          {sites
            .filter((site) => site.isActive || site.id === order?.workSiteId)
            .map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
        </Select>

        <Select label="Técnico" error={errors.assigneeId?.message} hint="Opcional. Sin técnico, la OT queda por asignar." {...register('assigneeId')}>
          <option value="">Sin asignar</option>
          {members
            .filter((member) => member.status !== 'Inactive' || member.id === order?.assigneeId)
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
                {member.branchName ? ` · ${member.branchName}` : ''}
              </option>
            ))}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Fecha" type="date" required error={errors.scheduledDate?.message} {...register('scheduledDate')} />
          <Input label="Hora" type="time" step={60} error={errors.scheduledTime?.message} hint="Opcional." {...register('scheduledTime')} />
        </div>

        <Textarea label="Notas" rows={3} placeholder="Indicaciones para el técnico" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Drawer>
  )
}
