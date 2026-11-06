import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, ChevronRight, MapPin, Plus, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { countryName } from '@/lib/geo'
import { branchStatusMeta } from '@/lib/labels'
import type { Branch, WorkGroup } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useBranches, useGroups } from '../api'
import { BranchForm } from '../components/BranchForm'
import { GroupForm } from '../components/GroupForm'

type Tab = 'sedes' | 'grupos'

export default function OrganizationPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'grupos' ? 'grupos' : 'sedes'
  const [branchEditor, setBranchEditor] = useState<{ open: boolean; branch: Branch | null }>({ open: false, branch: null })
  const [groupEditor, setGroupEditor] = useState<{ open: boolean; group: WorkGroup | null }>({ open: false, group: null })

  return (
    <>
      <PageHeader
        title="Organización"
        description="Sedes y grupos de trabajo. Solo los administradores pueden cambiarlos."
        actions={
          tab === 'sedes' ? (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setBranchEditor({ open: true, branch: null })}>
              Nueva sede
            </Button>
          ) : (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setGroupEditor({ open: true, group: null })}>
              Nuevo grupo
            </Button>
          )
        }
      />

      <Segmented
        ariaLabel="Secciones de organización"
        panelId="organization-panel"
        items={[
          { id: 'sedes', label: 'Sedes' },
          { id: 'grupos', label: 'Grupos' },
        ]}
        value={tab}
        onChange={(value) => setParams(value === 'sedes' ? {} : { tab: value }, { replace: true })}
        className="self-start"
      />

      <div id="organization-panel" role="tabpanel" className="flex flex-col gap-6">
        {tab === 'sedes' ? (
          <BranchesTab onEdit={(branch) => setBranchEditor({ open: true, branch })} onCreate={() => setBranchEditor({ open: true, branch: null })} />
        ) : (
          <GroupsTab onEdit={(group) => setGroupEditor({ open: true, group })} onCreate={() => setGroupEditor({ open: true, group: null })} />
        )}
      </div>

      <BranchForm
        open={branchEditor.open}
        branch={branchEditor.branch}
        onClose={() => setBranchEditor((state) => ({ ...state, open: false }))}
      />
      <GroupForm
        open={groupEditor.open}
        group={groupEditor.group}
        onClose={() => setGroupEditor((state) => ({ ...state, open: false }))}
      />
    </>
  )
}

function BranchesTab({ onEdit, onCreate }: { onEdit: (branch: Branch) => void; onCreate: () => void }) {
  const branches = useBranches()

  if (branches.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Cargando sedes">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="surface-card flex flex-col gap-3 p-5">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  if (branches.isError) {
    return (
      <Card padded={false}>
        <ErrorState message={errorMessage(branches.error)} onRetry={() => void branches.refetch()} />
      </Card>
    )
  }

  if (!branches.data?.length) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Aún no hay sedes"
          description="Cada persona pertenece a una sede. La sede define la ciudad, la zona horaria y los festivos."
          action={
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={onCreate}>
              Crear la primera sede
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {branches.data.map((branch) => {
        const meta = branchStatusMeta[branch.status]
        return (
          <li key={branch.id}>
            <button
              type="button"
              onClick={() => onEdit(branch)}
              aria-label={`Editar sede ${branch.name}`}
              className={cn(
                'surface-card group flex h-full w-full flex-col gap-3 p-5 text-left transition-colors hover:border-accent',
                branch.status !== 'Active' && 'opacity-90',
              )}
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span className="text-[17px] font-bold text-ink">{branch.name}</span>
                <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
              </span>
              <span className="text-sm text-ink-soft">
                {branch.city}, {countryName(branch.countryCode)} · {branch.timeZoneId}
              </span>
              <span className="flex flex-col gap-1 text-[13px] text-ink-muted">
                {branch.mainSiteName && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" aria-hidden /> {branch.mainSiteName}
                  </span>
                )}
                {branch.defaultTemplateName && <span>Horario por defecto: {branch.defaultTemplateName}</span>}
              </span>
              <span className="mt-auto flex w-full items-center justify-between border-t border-divider pt-3 text-[13px] text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <Users2 className="size-3.5" aria-hidden />
                  {branch.groups} {branch.groups === 1 ? 'grupo' : 'grupos'} · {branch.people}{' '}
                  {branch.people === 1 ? 'persona' : 'personas'}
                </span>
                <ChevronRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function GroupsTab({ onEdit, onCreate }: { onEdit: (group: WorkGroup) => void; onCreate: () => void }) {
  const [branchId, setBranchId] = useState('')
  const branches = useBranches()
  const groups = useGroups(branchId || undefined)

  const columns = useMemo<Column<WorkGroup>[]>(
    () => [
      {
        key: 'name',
        header: 'Grupo',
        render: (group) => <span className="font-semibold text-ink">{group.name}</span>,
      },
      { key: 'branch', header: 'Sede', render: (group) => group.branchName },
      { key: 'supervisor', header: 'Supervisor', render: (group) => group.supervisorName ?? 'Sin asignar' },
      {
        key: 'mdm',
        header: 'Grupo MobiControl',
        render: (group) => group.mdmGroupPath ?? <span className="text-ink-muted">— (solo panel web)</span>,
      },
      { key: 'people', header: 'Personas', align: 'right', render: (group) => <span className="tabular">{group.people}</span> },
      {
        key: 'status',
        header: 'Estado',
        render: (group) => (
          <StatusChip tone={group.isActive ? 'positive' : 'neutral'}>{group.isActive ? 'Activo' : 'Inactivo'}</StatusChip>
        ),
      },
    ],
    [],
  )

  return (
    <DataTable
      caption="Grupos de trabajo"
      columns={columns}
      rows={groups.data}
      rowKey={(group) => group.id}
      loading={groups.isLoading}
      onRowClick={onEdit}
      rowLabel={(group) => `Editar grupo ${group.name}`}
      error={groups.isError ? <ErrorState message={errorMessage(groups.error)} onRetry={() => void groups.refetch()} /> : undefined}
      toolbar={
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sede
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          >
            <option value="">Todas</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      }
      empty={
        <EmptyState
          icon={<Users2 className="size-5" />}
          title={branchId ? 'Esta sede no tiene grupos' : 'Aún no hay grupos'}
          description="Los grupos reúnen a las personas de una sede con su supervisor y su horario por defecto."
          action={
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={onCreate}>
              Nuevo grupo
            </Button>
          }
        />
      }
    />
  )
}
