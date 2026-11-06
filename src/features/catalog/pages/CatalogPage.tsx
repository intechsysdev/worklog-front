import { useState } from 'react'
import { toast } from 'sonner'
import { ListChecks, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Switch } from '@/components/ui/Field'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Tag } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { ActivityType, PatchActivityTypeCommand } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useCatalog, usePatchActivity, useSetOutcome } from '../api'
import { ActivityForm } from '../components/ActivityForm'
import { CategoriesCard } from '../components/CategoriesCard'

const NEW_DAYS = 7

export default function CatalogPage() {
  const catalog = useCatalog()
  const patch = usePatchActivity()
  const setOutcome = useSetOutcome()
  const [editing, setEditing] = useState<ActivityType | 'new' | null>(null)

  const toggle = (activity: ActivityType, change: PatchActivityTypeCommand, label: string) => {
    patch.mutate(
      { id: activity.id, patch: change },
      {
        onSuccess: () => toast.success(`${activity.name}: ${label}.`, { duration: 2500 }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const columns: Column<ActivityType>[] = [
      {
        key: 'name',
        header: 'Actividad',
        render: (activity) => (
          <span className="flex items-start justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn('font-semibold', activity.isActive ? 'text-ink' : 'text-ink-muted')}>{activity.name}</span>
              {Date.now() - new Date(activity.createdAt).getTime() < NEW_DAYS * 86_400_000 && <Tag tone="accent">Nueva</Tag>}
            </span>
            <Button variant="ghost" size="icon-sm" className="-my-1 shrink-0" aria-label={`Editar ${activity.name}`} onClick={() => setEditing(activity)}>
              <Pencil className="size-3.5" aria-hidden />
            </Button>
          </span>
        ),
      },
      {
        key: 'category',
        header: 'Categoría',
        render: (activity) => (
          <span className="inline-flex items-center gap-2 text-ink-soft">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: activity.categoryColor }} aria-hidden />
            {activity.categoryName}
          </span>
        ),
      },
      {
        key: 'photo',
        header: 'Foto',
        render: (activity) => (
          <Switch
            checked={activity.requiresPhoto}
            ariaLabel={`Exigir foto en ${activity.name}`}
            onChange={(value) => toggle(activity, { requiresPhoto: value }, value ? 'exige foto' : 'sin foto')}
          />
        ),
      },
      {
        key: 'signature',
        header: 'Firma',
        render: (activity) => (
          <Switch
            checked={activity.requiresSignature}
            ariaLabel={`Exigir firma del cliente en ${activity.name}`}
            onChange={(value) => toggle(activity, { requiresSignature: value }, value ? 'exige firma' : 'sin firma')}
          />
        ),
      },
      {
        key: 'observation',
        header: 'Observación',
        render: (activity) => (
          <span className="inline-flex items-center gap-2">
            <Switch
              checked={activity.observation === 'Always'}
              ariaLabel={`Observación siempre en ${activity.name}`}
              onChange={(value) =>
                toggle(activity, { observation: value ? 'Always' : 'Optional' }, value ? 'observación siempre' : 'observación opcional')
              }
            />
            <span className="hidden text-[13px] text-ink-muted min-[1281px]:inline">{activity.observation === 'Always' ? 'Siempre' : 'Opcional'}</span>
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Activa',
        render: (activity) => (
          <Switch
            checked={activity.isActive}
            ariaLabel={`${activity.name} activa`}
            onChange={(value) => toggle(activity, { isActive: value }, value ? 'activa' : 'inactiva')}
          />
        ),
      },
  ]

  const data = catalog.data

  return (
    <>
      <PageHeader
        title="Actividades y resultados"
        description="El catálogo que ve el usuario en la app y lo que exige cada actividad al finalizar."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
            Nueva actividad
          </Button>
        }
      />

      <div className="grid gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <DataTable
            caption="Catálogo de actividades"
            columns={columns}
            rows={data?.activities}
            rowKey={(activity) => activity.id}
            loading={catalog.isLoading}
            minWidth={640}
            error={catalog.isError ? <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} /> : undefined}
            empty={
              <EmptyState
                icon={<ListChecks className="size-5" />}
                title="El catálogo está vacío"
                description="Las actividades son lo que el usuario elige en la app al empezar a trabajar."
                action={
                  <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
                    Nueva actividad
                  </Button>
                }
              />
            }
          />
          <p className="px-1 text-[13px] leading-relaxed text-ink-muted">
            La categoría define el color en el historial y si el tiempo cuenta como productivo. Los cambios llegan a la app en la
            siguiente sincronización.
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Configuración del catálogo">
          {editing !== null && data && (
            <ActivityForm
              key={editing === 'new' ? 'new' : editing.id}
              activity={editing === 'new' ? null : editing}
              categories={data.categories}
              existingNames={data.activities}
              onClose={() => setEditing(null)}
            />
          )}

          <Card className="flex flex-col gap-3" aria-labelledby="outcomes-title">
            <h2 id="outcomes-title" className="text-lg font-bold text-ink">
              Resultados de cierre
            </h2>
            {!data ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (
              <ul className="flex flex-col">
                {data.outcomes.map((outcome) => (
                  <li key={outcome.outcome} className="flex items-center justify-between gap-3 border-t border-divider py-3 first:border-t-0 first:pt-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold text-ink">{outcome.label}</span>
                      <span className="text-[13px] text-ink-muted">{outcome.description}</span>
                    </span>
                    <Button
                      size="sm"
                      variant={outcome.requiresObservation ? 'primary' : 'secondary'}
                      aria-pressed={outcome.requiresObservation}
                      loading={setOutcome.isPending && setOutcome.variables?.outcome === outcome.outcome}
                      onClick={() =>
                        setOutcome.mutate(
                          { outcome: outcome.outcome, requiresObservation: !outcome.requiresObservation },
                          {
                            onSuccess: () =>
                              toast.success(`${outcome.label}: ${outcome.requiresObservation ? 'sin observación' : 'pide observación'}.`),
                            onError: (error) => toast.error(errorMessage(error)),
                          },
                        )
                      }
                    >
                      {outcome.requiresObservation ? 'Pide observación' : 'Sin observación'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data && <CategoriesCard categories={data.categories} palette={data.palette} />}
        </aside>
      </div>
    </>
  )
}
