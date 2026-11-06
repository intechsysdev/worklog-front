import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { KeyValueList, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { countries, countryByCode, findCity } from '@/lib/geo'
import { branchStatusMeta } from '@/lib/labels'
import type { Branch, SaveBranchCommand } from '@/lib/types'
import { useSites } from '@/features/sites/api'
import { useTemplates } from '@/features/schedules/api'
import { useSaveBranch, useSetBranchActive } from '../api'

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de la sede (mínimo 2 caracteres).').max(120, 'Máximo 120 caracteres.'),
  countryCode: z.string().min(1, 'Elige el país.'),
  city: z.string().min(1, 'Elige la ciudad.'),
  mainSiteId: z.string(),
  defaultTemplateId: z.string(),
})

type FormValues = z.infer<typeof schema>
const fields = ['name', 'countryCode', 'city', 'mainSiteId', 'defaultTemplateId'] as const

export function BranchForm({ branch, open, onClose }: { branch: Branch | null; open: boolean; onClose: () => void }) {
  const isNew = !branch
  const save = useSaveBranch()
  const setActive = useSetBranchActive()
  const sites = useSites()
  const templates = useTemplates()
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset({
      name: branch?.name ?? '',
      countryCode: branch?.countryCode ?? 'CO',
      city: branch?.city ?? '',
      mainSiteId: branch?.mainSiteId ?? '',
      defaultTemplateId: branch?.defaultTemplateId ?? '',
    })
  }, [open, branch, reset])

  const countryCode = useWatch({ control, name: 'countryCode' })
  const cityName = useWatch({ control, name: 'city' })
  const country = countryByCode(countryCode)

  // Una sede creada con una ciudad que no está en la lista local se conserva como opción.
  const cityOptions = useMemo(() => {
    const list = country?.cities ?? []
    if (branch && branch.countryCode === countryCode && !list.some((city) => city.name === branch.city)) {
      return [...list, { name: branch.city, region: branch.region ?? '', timeZoneId: branch.timeZoneId, latitude: 0, longitude: 0 }]
    }
    return list
  }, [country, countryCode, branch])

  const city = cityOptions.find((option) => option.name === cityName)

  const submit = async (values: FormValues, asDraft = false) => {
    const resolvedCity = findCity(values.countryCode, values.city) ?? city
    const command: SaveBranchCommand = {
      name: values.name.trim(),
      countryCode: values.countryCode,
      city: values.city,
      region: resolvedCity?.region || null,
      timeZoneId: resolvedCity?.timeZoneId ?? '',
      mainSiteId: values.mainSiteId || null,
      defaultTemplateId: values.defaultTemplateId || null,
      asDraft: isNew ? asDraft : undefined,
    }

    try {
      const saved = await save.mutateAsync({ id: branch?.id, command })
      toast.success(isNew ? `Sede «${saved.name}» ${asDraft ? 'guardada como borrador' : 'creada'}.` : 'Cambios guardados.')
      onClose()
    } catch (error) {
      applyApiErrors(error, setError, fields, { timeZoneId: 'city', region: 'city' })
    }
  }

  const toggleActive = async (active: boolean) => {
    if (!branch) return
    try {
      await setActive.mutateAsync({ id: branch.id, active })
      toast.success(active ? 'Sede activada.' : 'Sede desactivada.')
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
        eyebrow={isNew ? 'Nueva sede' : 'Editar sede'}
        title={isNew ? 'Crear sede' : branch.name}
        description={branch && <StatusChip tone={branchStatusMeta[branch.status].tone}>{branchStatusMeta[branch.status].label}</StatusChip>}
        footer={
          <>
            <Button type="submit" form="branch-form" variant="primary" loading={isSubmitting}>
              {isNew ? 'Crear sede' : 'Guardar'}
            </Button>
            {isNew && (
              <Button disabled={busy} onClick={handleSubmit((values) => submit(values, true))}>
                Guardar borrador
              </Button>
            )}
            {branch && branch.status === 'Active' && (
              <Button variant="danger" icon={<PowerOff className="size-4" aria-hidden />} disabled={busy} onClick={() => setConfirmDeactivate(true)} className="ml-auto">
                Desactivar
              </Button>
            )}
            {branch && branch.status !== 'Active' && (
              <Button icon={<Power className="size-4" aria-hidden />} loading={setActive.isPending} disabled={busy} onClick={() => void toggleActive(true)} className="ml-auto">
                Activar
              </Button>
            )}
          </>
        }
      >
        <form id="branch-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit((values) => submit(values))}>
          <Input label="Nombre" required placeholder="Ej.: Bogotá Norte" error={errors.name?.message} {...register('name')} />

          <Select
            label="País"
            required
            error={errors.countryCode?.message}
            hint={country ? `Código ISO ${country.code}` : undefined}
            {...register('countryCode', { onChange: () => setValue('city', '') })}
          >
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </Select>

          <Select
            label="Ciudad"
            required
            disabled={!country}
            error={errors.city?.message}
            hint={city ? [city.region, country?.name, city.code && `código ${city.code}`].filter(Boolean).join(' · ') : country ? 'La zona horaria y los festivos salen de la ciudad.' : 'Elige primero el país.'}
            {...register('city')}
          >
            <option value="">Elige la ciudad</option>
            {cityOptions.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </Select>

          <Select
            label="Sitio principal"
            hint="Opcional. Es la geocerca de la propia sede; créala en Sitios y geocercas."
            error={errors.mainSiteId?.message}
            {...register('mainSiteId')}
          >
            <option value="">Sin sitio principal</option>
            {sites.data?.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>

          <Select
            label="Horario por defecto"
            hint="Opcional. Para asignarlo con fecha de inicio usa Asignaciones."
            error={errors.defaultTemplateId?.message}
            {...register('defaultTemplateId')}
          >
            <option value="">Sin horario por defecto</option>
            {templates.data
              ?.filter((template) => template.isActive || template.id === branch?.defaultTemplateId)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.summary}
                </option>
              ))}
          </Select>

          <div className="rounded-[12px] bg-inset p-4">
            <KeyValueList
              items={[
                { label: 'Festivos', value: country?.holidays ?? '—' },
                { label: 'Zona horaria', value: city ? `${city.timeZoneId} · se toma de la ciudad` : '—' },
                { label: 'Reglas laborales', value: country?.laborRules ?? 'Por configurar' },
              ]}
            />
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => void toggleActive(false)}
        loading={setActive.isPending}
        title="¿Desactivar la sede?"
        confirmLabel="Desactivar sede"
        description={
          <>
            <strong>{branch?.name}</strong> dejará de aparecer para nuevas asignaciones. No se puede desactivar si aún tiene
            personas.
          </>
        }
      />
    </>
  )
}
