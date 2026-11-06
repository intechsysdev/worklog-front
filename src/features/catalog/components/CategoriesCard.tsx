import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Input } from '@/components/ui/Field'
import { Card } from '@/components/ui/Primitives'
import { applyApiErrors } from '@/lib/forms'
import { timeClassLabel } from '@/lib/labels'
import type { Category, TimeClass } from '@/lib/types'
import { cn, plural } from '@/lib/utils'
import { errorMessage } from '@/lib/api'
import { useSaveCategory, useSetCategoryActive } from '../api'

/** Nombres legibles de la paleta de §6 (el API puede traer más colores). */
const colorNames: Record<string, string> = {
  '#751326': 'Borgoña',
  '#E51E49': 'Rojo principal',
  '#AF1839': 'Rojo oscuro',
  '#5A5958': 'Gris medio',
  '#1E1F1D': 'Gris profundo',
  '#3C3C3B': 'Gris carbón',
  '#868787': 'Gris claro',
  '#F8B21D': 'Amarillo',
  '#DA830B': 'Ámbar',
  '#1E6B3F': 'Verde',
}

const schema = z.object({
  name: z.string().trim().min(2, 'El nombre necesita al menos 2 caracteres.').max(60, 'Máximo 60 caracteres.'),
  timeClass: z.enum(['Productive', 'PaidNonProductive', 'Unproductive']),
  color: z.string().min(1, 'Elige un color.'),
})

type FormValues = z.infer<typeof schema>

export function CategoriesCard({ categories, palette }: { categories: Category[]; palette: string[] }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  return (
    <Card className="flex flex-col gap-4" aria-labelledby="categories-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="categories-title" className="text-lg font-bold text-ink">
          Categorías
        </h2>
        {editing === null && (
          <Button variant="tertiary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
            Nueva categoría
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {categories.map((category) => (
          <li key={category.id} className={cn('group flex items-center gap-2.5 rounded-[10px] py-1.5 text-sm', !category.isActive && 'opacity-60')}>
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate font-semibold text-ink">
                {category.name}
                {!category.isActive && <span className="ml-1.5 text-[12px] font-normal text-ink-muted">(inactiva)</span>}
              </strong>
              <span className="text-[13px] text-ink-muted">
                {timeClassLabel[category.timeClass]} · {plural(category.activities, 'actividad', 'actividades')}
              </span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar categoría ${category.name}`} onClick={() => setEditing(category)}>
              <Pencil className="size-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {editing !== null && (
        <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} palette={palette} onClose={() => setEditing(null)} />
      )}
    </Card>
  )
}

function CategoryForm({ category, palette, onClose }: { category: Category | null; palette: string[]; onClose: () => void }) {
  const save = useSaveCategory()
  const setActive = useSetCategoryActive()
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
      name: category?.name ?? '',
      timeClass: category?.timeClass ?? 'Productive',
      color: category?.color ?? palette[0] ?? '#AF1839',
    },
  })

  const timeClass = useWatch({ control, name: 'timeClass' })
  const color = useWatch({ control, name: 'color' })

  const submit = async (values: FormValues) => {
    try {
      await save.mutateAsync({ id: category?.id, command: { ...values, name: values.name.trim() } })
      toast.success(category ? 'Categoría guardada.' : 'Categoría creada.')
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, ['name', 'timeClass', 'color'])
    }
  }

  return (
    <form className="flex flex-col gap-4 border-t border-line pt-4" noValidate onSubmit={handleSubmit(submit)}>
      <Input label="Nombre" required placeholder="Ej.: Capacitación externa" error={errors.name?.message} {...register('name')} />

      <FieldShell label="Cómo cuenta el tiempo">
        <ChipGroup<TimeClass>
          ariaLabel="Cómo cuenta el tiempo"
          options={(Object.keys(timeClassLabel) as TimeClass[]).map((value) => ({ value, label: timeClassLabel[value] }))}
          value={timeClass}
          onChange={(value) => setValue('timeClass', value)}
        />
      </FieldShell>

      <FieldShell label="Color en el historial" error={errors.color?.message}>
        <div role="radiogroup" aria-label="Color en el historial" className="flex flex-wrap gap-2">
          {palette.map((option) => {
            const selected = option.toUpperCase() === color.toUpperCase()
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={colorNames[option.toUpperCase()] ?? option}
                title={colorNames[option.toUpperCase()] ?? option}
                onClick={() => setValue('color', option)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-raised transition-shadow',
                  selected ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong',
                )}
                style={{ backgroundColor: option }}
              >
                {selected && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
              </button>
            )
          })}
        </div>
      </FieldShell>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {category ? 'Guardar' : 'Crear categoría'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        {category && (
          <Button
            variant={category.isActive ? 'danger' : 'secondary'}
            className="ml-auto"
            icon={category.isActive ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
            loading={setActive.isPending}
            onClick={() =>
              setActive.mutate(
                { id: category.id, active: !category.isActive },
                {
                  onSuccess: () => {
                    toast.success(category.isActive ? 'Categoría desactivada.' : 'Categoría activada.')
                    onClose()
                  },
                  // 409: aún tiene actividades activas; el API explica cuáles.
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            {category.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      </div>
    </form>
  )
}
