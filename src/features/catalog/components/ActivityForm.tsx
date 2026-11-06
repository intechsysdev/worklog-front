import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Input } from '@/components/ui/Field'
import { Card } from '@/components/ui/Primitives'
import { applyApiErrors } from '@/lib/forms'
import type { ActivityType, Category } from '@/lib/types'
import { normalize } from '@/lib/utils'
import { useSaveActivity } from '../api'

type Requirement = 'photo' | 'signature' | 'observation'

export function ActivityForm({
  activity,
  categories,
  existingNames,
  onClose,
}: {
  activity: ActivityType | null
  categories: Category[]
  existingNames: { id: string; name: string }[]
  onClose: () => void
}) {
  const isNew = !activity
  const save = useSaveActivity()

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(3, 'El nombre necesita al menos 3 caracteres.')
      .max(80, 'Máximo 80 caracteres.')
      .refine(
        (name) => !existingNames.some((item) => item.id !== activity?.id && normalize(item.name) === normalize(name)),
        'Ya existe una actividad con ese nombre.',
      ),
    categoryId: z.string().min(1, 'Elige la categoría.'),
    requirements: z.array(z.enum(['photo', 'signature', 'observation'])),
  })

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: activity?.name ?? '',
      categoryId: activity?.categoryId ?? categories.find((category) => category.isActive)?.id ?? '',
      requirements: activity
        ? [
            ...(activity.requiresPhoto ? (['photo'] as const) : []),
            ...(activity.requiresSignature ? (['signature'] as const) : []),
            ...(activity.observation === 'Always' ? (['observation'] as const) : []),
          ]
        : [],
    },
  })

  const categoryId = useWatch({ control, name: 'categoryId' })
  const requirements = useWatch({ control, name: 'requirements' })

  const submit = async (values: FormValues) => {
    try {
      const saved = await save.mutateAsync({
        id: activity?.id,
        command: {
          name: values.name.trim(),
          categoryId: values.categoryId,
          requiresPhoto: values.requirements.includes('photo'),
          requiresSignature: values.requirements.includes('signature'),
          observation: values.requirements.includes('observation') ? 'Always' : 'Optional',
        },
      })
      toast.success(
        isNew ? `«${saved.name}» aparece en el catálogo de la app en la siguiente sincronización.` : 'Actividad guardada.',
      )
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, ['name', 'categoryId'])
    }
  }

  return (
    <Card className="border-2 border-accent-solid" aria-labelledby="activity-form-title">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit(submit)}>
        <h2 id="activity-form-title" className="text-lg font-bold text-ink">
          {isNew ? 'Nueva actividad' : 'Editar actividad'}
        </h2>
        <Input label="Nombre" required placeholder="Ej.: Soporte remoto" error={errors.name?.message} {...register('name')} />

        <FieldShell label="Categoría" error={errors.categoryId?.message}>
          <ChipGroup
            ariaLabel="Categoría"
            invalid={!!errors.categoryId}
            options={categories
              .filter((category) => category.isActive || category.id === activity?.categoryId)
              .map((category) => ({
                value: category.id,
                label: (
                  <>
                    <span className="size-2.5 rounded-full ring-1 ring-white/60" style={{ backgroundColor: category.color }} aria-hidden />
                    {category.name}
                  </>
                ),
              }))}
            value={categoryId}
            onChange={(value) => setValue('categoryId', value, { shouldValidate: true })}
          />
        </FieldShell>

        <FieldShell label="Al finalizar exige">
          <ChipGroup<Requirement>
            multiple
            ariaLabel="Al finalizar exige"
            options={[
              { value: 'photo', label: 'Foto' },
              { value: 'signature', label: 'Firma del cliente' },
              { value: 'observation', label: 'Observación' },
            ]}
            value={requirements}
            onChange={(value) =>
              setValue(
                'requirements',
                requirements.includes(value) ? requirements.filter((item) => item !== value) : [...requirements, value],
              )
            }
          />
        </FieldShell>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isNew ? 'Crear actividad' : 'Guardar'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}
