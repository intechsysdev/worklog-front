import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput, Segmented } from '@/components/ui/Controls'
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable'
import { Avatar, EmptyState, ErrorState, PageHeader, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { memberStatusMeta, memberUsageLabel } from '@/lib/labels'
import type { Member, MemberStatus, MemberUsage } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { useBranches } from '@/features/organization/api'
import { useMembers, useRoles } from '../api'
import { InviteDialog } from '../components/InviteDialog'
import { MemberPanel } from '../components/MemberPanel'
import { RolesMatrix } from '../components/RolesMatrix'

const PAGE_SIZE = 20
const filterClass =
  'h-10 rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25'

export default function UsersPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'roles' ? 'roles' : 'usuarios'
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Quién entra a WorkLog, qué puede hacer y qué dispositivo de SOTI MobiControl tiene asignado."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setInviteOpen(true)}>
            Invitar usuario
          </Button>
        }
      />

      <Segmented
        ariaLabel="Secciones"
        panelId="users-panel"
        items={[
          { id: 'usuarios', label: 'Usuarios' },
          { id: 'roles', label: 'Roles y permisos' },
        ]}
        value={tab}
        onChange={(value) => setParams(value === 'roles' ? { tab: 'roles' } : {}, { replace: true })}
        className="self-start"
      />

      <div id="users-panel" role="tabpanel" className="flex min-w-0 flex-col gap-6">
        {tab === 'usuarios' ? <UsersTab onInvite={() => setInviteOpen(true)} /> : <RolesMatrix />}
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onViewUsers={() => setParams({}, { replace: true })} />
    </>
  )
}

function UsersTab({ onInvite }: { onInvite: () => void }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<MemberStatus | ''>('')
  const [usage, setUsage] = useState<MemberUsage | ''>('')
  const [editing, setEditing] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null })
  const debouncedSearch = useDebounced(search.trim(), 350)

  const members = useMembers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    branchId: branchId || undefined,
    roleId: roleId || undefined,
    status: status || undefined,
    usage: usage || undefined,
  })
  const branches = useBranches()
  const roles = useRoles()

  const filtered = !!(debouncedSearch || branchId || roleId || status || usage)
  const clear = () => {
    setSearch('')
    setBranchId('')
    setRoleId('')
    setStatus('')
    setUsage('')
    setPage(1)
  }
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value)
      setPage(1)
    }

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (member) => (
        <span className="flex items-center gap-2.5">
          <Avatar initials={member.initials} size="sm" tone="dark" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-ink">{member.fullName}</span>
            <span className="truncate text-[12px] text-ink-muted">{member.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (member) => (
        <span className="flex flex-col">
          <span className="text-ink">{member.roleName}</span>
          <span className="text-[12px] text-ink-muted">{memberUsageLabel[member.usage]}</span>
        </span>
      ),
    },
    { key: 'branch', header: 'Sede', render: (member) => member.branchName ?? '—' },
    { key: 'group', header: 'Grupo', render: (member) => member.workGroupName ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (member) => <StatusChip tone={memberStatusMeta[member.status].tone}>{memberStatusMeta[member.status].label}</StatusChip>,
    },
  ]

  const data = members.data

  return (
    <>
      <DataTable
        caption="Usuarios"
        columns={columns}
        rows={data?.items}
        rowKey={(member) => member.id}
        loading={members.isLoading}
        onRowClick={(member) => setEditing({ open: true, member })}
        rowLabel={(member) => `Editar a ${member.fullName}`}
        selectedKey={editing.open ? (editing.member?.id ?? null) : null}
        error={members.isError && !data ? <ErrorState message={errorMessage(members.error)} onRetry={() => void members.refetch()} /> : undefined}
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-3">
            <SearchInput label="Buscar usuario" placeholder="Buscar por nombre o correo" value={search} onChange={withReset(setSearch)} className="basis-full sm:basis-auto sm:flex-1" />
            <select aria-label="Sede" value={branchId} onChange={(event) => withReset(setBranchId)(event.target.value)} className={filterClass}>
              <option value="">Todas las sedes</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select aria-label="Rol" value={roleId} onChange={(event) => withReset(setRoleId)(event.target.value)} className={filterClass}>
              <option value="">Todos los roles</option>
              {roles.data?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <select aria-label="Estado" value={status} onChange={(event) => withReset(setStatus)(event.target.value as MemberStatus | '')} className={filterClass}>
              <option value="">Todos los estados</option>
              {(Object.keys(memberStatusMeta) as MemberStatus[]).map((value) => (
                <option key={value} value={value}>
                  {memberStatusMeta[value].label}
                </option>
              ))}
            </select>
            <select aria-label="Uso" value={usage} onChange={(event) => withReset(setUsage)(event.target.value as MemberUsage | '')} className={filterClass}>
              <option value="">Móvil y panel</option>
              <option value="Mobile">{memberUsageLabel.Mobile}</option>
              <option value="WebOnly">{memberUsageLabel.WebOnly}</option>
            </select>
            {filtered && (
              <Button variant="ghost" size="sm" icon={<X className="size-3.5" aria-hidden />} onClick={clear}>
                Limpiar
              </Button>
            )}
          </div>
        }
        empty={
          <EmptyState
            icon={<Users className="size-5" />}
            title={filtered ? 'Nadie coincide con los filtros' : 'Aún no hay usuarios'}
            description={filtered ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Invita a las personas que usarán la app o el panel.'}
            action={
              filtered ? (
                <Button size="sm" onClick={clear}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button size="sm" variant="primary" icon={<UserPlus className="size-3.5" aria-hidden />} onClick={onInvite}>
                  Invitar usuario
                </Button>
              )
            }
          />
        }
        footer={
          data && data.totalCount > 0 ? (
            <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} noun={['usuario', 'usuarios']} />
          ) : undefined
        }
      />

      <MemberPanel member={editing.member} open={editing.open} onClose={() => setEditing((state) => ({ ...state, open: false }))} />
    </>
  )
}
