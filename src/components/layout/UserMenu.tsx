import { Building2, Check, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react'
import { DropdownMenu, MenuItem, MenuSeparator } from '@/components/ui/Controls'
import { Avatar } from '@/components/ui/Primitives'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'

/** Avatar con nombre y rol; abre el menú con empresa, tema y salida. */
export function UserMenu({ side = 'top', className }: { side?: 'top' | 'bottom'; className?: string }) {
  const { profile, tenants, session, selectTenant, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  if (!profile) return null

  const currentTenant = tenants.find((tenant) => tenant.tenantId === session?.tenantId)

  return (
    <DropdownMenu
      side={side}
      align={side === 'top' ? 'start' : 'end'}
      className={className}
      menuClassName={side === 'top' ? 'w-full' : 'w-72'}
      trigger={({ open, toggle: toggleMenu, id }) => (
        <button
          type="button"
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-[12px] border border-transparent p-2 text-left transition-colors hover:border-line hover:bg-inset',
            open && 'border-line bg-inset',
          )}
        >
          <Avatar initials={profile.initials} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{profile.fullName}</span>
            <span className="truncate text-[12px] text-ink-muted">
              {profile.roleName} · {currentTenant?.name ?? profile.tenantName}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-ink">{profile.fullName}</p>
            <p className="truncate text-[12px] text-ink-muted">{profile.email}</p>
          </div>

          {tenants.length > 1 && (
            <>
              <MenuSeparator />
              <p className="section-label px-2.5 pt-1.5 pb-1">Empresa</p>
              {tenants.map((tenant) => {
                const selected = tenant.tenantId === session?.tenantId
                return (
                  <MenuItem
                    key={tenant.tenantId}
                    icon={selected ? <Check className="size-4 text-accent" /> : <Building2 className="size-4" />}
                    selected={selected}
                    onClick={() => {
                      close()
                      if (!selected) selectTenant(tenant.tenantId)
                    }}
                  >
                    <span className="truncate">{tenant.name}</span>
                  </MenuItem>
                )
              })}
            </>
          )}

          <MenuSeparator />
          <MenuItem
            icon={theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            onClick={() => {
              toggle()
              close()
            }}
          >
            {theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
          </MenuItem>
          <MenuItem
            icon={<LogOut className="size-4" />}
            tone="danger"
            onClick={() => {
              close()
              void signOut()
            }}
          >
            Cerrar sesión
          </MenuItem>
        </>
      )}
    </DropdownMenu>
  )
}
