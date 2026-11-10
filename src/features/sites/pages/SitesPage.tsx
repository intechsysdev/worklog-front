import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Plus, Power, PowerOff, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented, Stepper } from '@/components/ui/Controls'
import { FieldShell, Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Card, EmptyState, ErrorState, InlineMessage, ListSkeleton, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { api, errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { DEFAULT_CENTER } from '@/lib/geo'
import { keys } from '@/lib/queries'
import type { GeoPoint, GeofenceShape, ParameterRow, WorkSite } from '@/lib/types'
import { cn, plural } from '@/lib/utils'
import { useSaveSite, useSetSiteActive, useSites } from '../api'
import { MobiControlBadge, MobiControlStatus, SyncAllButton } from '../components/MobiControlSync'
import { SiteMap } from '../components/SiteMap'
import { centroid, MAX_RADIUS, MAX_VERTICES, MIN_RADIUS, MIN_VERTICES, round6 } from '../geometry'

const point = z.object({ latitude: z.number(), longitude: z.number() })

const schema = z
  .object({
    name: z.string().trim().min(2, 'Escribe el nombre del sitio (mínimo 2 caracteres).').max(120, 'Máximo 120 caracteres.'),
    address: z.string().trim().max(250, 'Máximo 250 caracteres.'),
    shape: z.enum(['Circle', 'Polygon']),
    radiusMeters: z.number().min(MIN_RADIUS).max(MAX_RADIUS),
    latitude: z.number({ error: 'Escribe la latitud.' }).min(-90, 'Latitud entre −90 y 90.').max(90, 'Latitud entre −90 y 90.'),
    longitude: z.number({ error: 'Escribe la longitud.' }).min(-180, 'Longitud entre −180 y 180.').max(180, 'Longitud entre −180 y 180.'),
    vertices: z.array(point),
  })
  .superRefine((values, context) => {
    if (values.shape === 'Polygon' && values.vertices.length < MIN_VERTICES) {
      context.addIssue({ code: 'custom', path: ['vertices'], message: 'Marca al menos tres esquinas en el mapa.' })
    }
    if (values.vertices.length > MAX_VERTICES) {
      context.addIssue({ code: 'custom', path: ['vertices'], message: `El polígono admite máximo ${MAX_VERTICES} esquinas.` })
    }
  })

type FormValues = z.infer<typeof schema>
const fields = ['name', 'address', 'shape', 'radiusMeters', 'latitude', 'longitude', 'vertices'] as const

type Selection = { kind: 'site'; id: string } | { kind: 'new' } | null

export default function SitesPage() {
  const [showInactive, setShowInactive] = useState(false)
  const sites = useSites(true)
  const [selection, setSelection] = useState<Selection>(null)

  const visible = useMemo(
    () => (sites.data ?? []).filter((site) => showInactive || site.isActive),
    [sites.data, showInactive],
  )

  // Al entrar se abre el primer sitio, como en el diseño.
  const effectiveSelection: Selection =
    selection ?? (visible[0] ? { kind: 'site', id: visible[0].id } : sites.isSuccess ? { kind: 'new' } : null)
  const selected = effectiveSelection?.kind === 'site' ? (sites.data?.find((site) => site.id === effectiveSelection.id) ?? null) : null

  return (
    <>
      <PageHeader
        title="Sitios y geocercas"
        description="La app valida que el usuario esté dentro de la geocerca al iniciar y finalizar cada actividad."
        actions={
          <>
            <SyncAllButton />
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setSelection({ kind: 'new' })}>
              Nuevo sitio
            </Button>
          </>
        }
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-[320px_minmax(0,1fr)]">
        <Card padded={false} className="flex flex-col self-start" aria-label="Sitios">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <span className="section-label">{plural(visible.length, 'sitio')}</span>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="size-4 accent-[var(--accent-solid)]"
              />
              Ver inactivos
            </label>
          </div>
          {sites.isLoading ? (
            <ListSkeleton />
          ) : sites.isError ? (
            <ErrorState message={errorMessage(sites.error)} onRetry={() => void sites.refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<MapPin className="size-5" />}
              title="Aún no hay sitios"
              description="Crea el primero con el formulario: ubícalo en el mapa y ajusta el radio."
            />
          ) : (
            <ul className="flex max-h-[640px] flex-col gap-1 overflow-y-auto p-2">
              {visible.map((site) => {
                const active = selected?.id === site.id
                return (
                  <li key={site.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelection({ kind: 'site', id: site.id })}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-[12px] border-2 px-3 py-2.5 text-left transition-colors',
                        active ? 'border-accent-solid bg-accent-soft' : 'border-transparent hover:bg-inset',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{site.name}</span>
                        {!site.isActive && <StatusChip tone="neutral">Inactivo</StatusChip>}
                      </span>
                      {site.address && <span className="text-[13px] text-ink-soft">{site.address}</span>}
                      <span className="text-[13px] text-ink-muted">
                        {site.shape === 'Circle' ? `Círculo de ${site.radiusMeters} m` : `Polígono de ${site.vertices.length} esquinas`} ·{' '}
                        {site.workOrdersThisWeek} OT esta semana
                      </span>
                      <MobiControlBadge site={site} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {effectiveSelection && (
          <SiteEditor
            key={effectiveSelection.kind === 'site' ? effectiveSelection.id : 'new'}
            site={selected}
            others={(sites.data ?? []).filter((site) => site.id !== selected?.id && site.isActive)}
            onSaved={(site) => setSelection({ kind: 'site', id: site.id })}
            onDiscard={() => setSelection(visible[0] ? { kind: 'site', id: visible[0].id } : null)}
          />
        )}
      </div>
    </>
  )
}

function useDefaultRadius() {
  const query = useQuery({
    queryKey: keys.parameters('Company'),
    queryFn: () => api.get<ParameterRow[]>('/parameters/Company'),
    staleTime: 5 * 60_000,
  })
  return query.data?.find((row) => row.code === 'rad')?.value ?? 100
}

function SiteEditor({
  site,
  others,
  onSaved,
  onDiscard,
}: {
  site: WorkSite | null
  others: WorkSite[]
  onSaved: (site: WorkSite) => void
  onDiscard: () => void
}) {
  const isNew = !site
  const save = useSaveSite()
  const setActive = useSetSiteActive()
  const defaultRadius = useDefaultRadius()
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const start = site ?? others[0]
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: site?.name ?? '',
      address: site?.address ?? '',
      shape: site?.shape ?? 'Circle',
      radiusMeters: site?.radiusMeters ?? defaultRadius,
      latitude: start?.latitude ?? DEFAULT_CENTER.latitude,
      longitude: start?.longitude ?? DEFAULT_CENTER.longitude,
      vertices: site?.vertices ?? [],
    },
  })

  // El radio por defecto llega del parámetro "rad" un poco después.
  useEffect(() => {
    if (isNew) setValue('radiusMeters', defaultRadius)
  }, [isNew, defaultRadius, setValue])

  const shape = useWatch({ control, name: 'shape' })
  const radius = useWatch({ control, name: 'radiusMeters' })
  const latitude = useWatch({ control, name: 'latitude' })
  const longitude = useWatch({ control, name: 'longitude' })
  const vertices = useWatch({ control, name: 'vertices' })

  const center: GeoPoint = {
    latitude: Number.isFinite(latitude) ? latitude : DEFAULT_CENTER.latitude,
    longitude: Number.isFinite(longitude) ? longitude : DEFAULT_CENTER.longitude,
  }

  const setCenter = (point: GeoPoint) => {
    setValue('latitude', round6(point.latitude), { shouldDirty: true, shouldValidate: true })
    setValue('longitude', round6(point.longitude), { shouldDirty: true, shouldValidate: true })
  }

  const setVertices = (next: GeoPoint[]) => {
    setValue('vertices', next, { shouldDirty: true })
    clearErrors('vertices')
    const middle = centroid(next)
    if (middle) setCenter(middle)
  }

  const submit = async (values: FormValues) => {
    try {
      const saved = await save.mutateAsync({
        id: site?.id,
        command: {
          name: values.name.trim(),
          address: values.address.trim() || null,
          shape: values.shape,
          latitude: values.latitude,
          longitude: values.longitude,
          radiusMeters: values.shape === 'Circle' ? values.radiusMeters : null,
          vertices: values.shape === 'Polygon' ? values.vertices.map((p) => ({ latitude: round6(p.latitude), longitude: round6(p.longitude) })) : null,
        },
      })
      toast.success(isNew ? `Sitio «${saved.name}» creado. La app lo usa en la siguiente sincronización.` : 'Sitio guardado.')
      onSaved(saved)
    } catch (error) {
      applyApiErrors(error, setError, fields)
    }
  }

  const toggleActive = async (active: boolean) => {
    if (!site) return
    try {
      await setActive.mutateAsync({ id: site.id, active })
      toast.success(active ? 'Sitio activado.' : 'Sitio desactivado.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirmDeactivate(false)
    }
  }

  return (
    <Card padded={false} className="flex min-w-0 flex-col overflow-hidden" aria-label={isNew ? 'Nuevo sitio' : `Sitio ${site.name}`}>
      <div className="h-[340px] border-b border-line p-2 sm:h-[400px]">
        <SiteMap
          focusKey={site?.id ?? 'new'}
          shape={shape}
          center={center}
          radius={radius}
          vertices={vertices}
          others={others}
          onCenterChange={setCenter}
          onAddVertex={(point) => vertices.length < MAX_VERTICES && setVertices([...vertices, point])}
        />
      </div>

      <form className="flex flex-col gap-5 p-5" noValidate onSubmit={handleSubmit(submit)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">{isNew ? 'Nuevo sitio' : site.name}</h2>
          {site && <StatusChip tone={site.isActive ? 'positive' : 'neutral'}>{site.isActive ? 'Activo' : 'Inactivo'}</StatusChip>}
        </div>

        {site && <MobiControlStatus site={site} />}

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nombre" required placeholder="Ej.: Bodega Occidente" error={errors.name?.message} {...register('name')} />
          <Input label="Dirección" placeholder="Calle, número y ciudad" error={errors.address?.message} {...register('address')} />
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <FieldShell label="Forma">
            <Segmented<GeofenceShape>
              ariaLabel="Forma de la geocerca"
              items={[
                { id: 'Circle', label: 'Círculo' },
                { id: 'Polygon', label: 'Polígono' },
              ]}
              value={shape}
              onChange={(value) => setValue('shape', value, { shouldDirty: true })}
            />
          </FieldShell>

          {shape === 'Circle' ? (
            <Stepper
              label="Radio"
              value={radius}
              onChange={(value) => setValue('radiusMeters', value, { shouldDirty: true })}
              step={10}
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              format={(value) => `${value} m`}
              decreaseLabel="Reducir radio 10 metros"
              increaseLabel="Ampliar radio 10 metros"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular text-sm font-semibold text-ink">{vertices.length} esquinas</span>
              <Button size="sm" icon={<Undo2 className="size-3.5" aria-hidden />} disabled={vertices.length === 0} onClick={() => setVertices(vertices.slice(0, -1))}>
                Quitar la última
              </Button>
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" aria-hidden />} disabled={vertices.length === 0} onClick={() => setVertices([])}>
                Borrar esquinas
              </Button>
            </div>
          )}
        </div>

        {shape === 'Polygon' && (
          <InlineMessage tone={errors.vertices ? 'error' : 'info'}>
            {errors.vertices?.message ??
              'Con polígono, haz clic en el mapa para marcar cada esquina del sitio. Úsalo en bodegas o sedes alargadas.'}
          </InlineMessage>
        )}

        <details className="group rounded-[12px] bg-inset px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-ink-soft">Coordenadas del centro</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Input
              label="Latitud"
              type="number"
              step="0.000001"
              inputMode="decimal"
              disabled={shape === 'Polygon'}
              error={errors.latitude?.message}
              {...register('latitude', { valueAsNumber: true })}
            />
            <Input
              label="Longitud"
              type="number"
              step="0.000001"
              inputMode="decimal"
              disabled={shape === 'Polygon'}
              error={errors.longitude?.message}
              {...register('longitude', { valueAsNumber: true })}
            />
          </div>
          <p className="mt-2 text-[13px] text-ink-muted">
            {shape === 'Circle'
              ? 'También puedes hacer clic en el mapa o arrastrar el marcador.'
              : 'En un polígono el centro se calcula con las esquinas.'}
          </p>
        </details>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isNew ? 'Crear sitio' : 'Guardar sitio'}
          </Button>
          {isNew && (
            <Button variant="ghost" onClick={onDiscard} disabled={isSubmitting}>
              Descartar
            </Button>
          )}
          {site?.isActive && (
            <Button variant="danger" className="ml-auto" icon={<PowerOff className="size-4" aria-hidden />} onClick={() => setConfirmDeactivate(true)}>
              Desactivar
            </Button>
          )}
          {site && !site.isActive && (
            <Button className="ml-auto" icon={<Power className="size-4" aria-hidden />} loading={setActive.isPending} onClick={() => void toggleActive(true)}>
              Activar
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => void toggleActive(false)}
        loading={setActive.isPending}
        title="¿Desactivar el sitio?"
        confirmLabel="Desactivar sitio"
        description={
          <>
            <strong>{site?.name}</strong> dejará de aparecer en la app para nuevas actividades y órdenes de trabajo, y su geocerca
            se borra de MobiControl. El historial se conserva.
          </>
        }
      />
    </Card>
  )
}
