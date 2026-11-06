import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { UserMenu } from './UserMenu'
import { navigation } from './nav'
import { usePendingApprovals } from '@/features/approvals/api'

/**
 * Estructura del panel (§6): grid 288 px | 1fr. En ≤900 px el sidebar pasa a barra superior con
 * botón de menú y el contenido usa padding 20/16.
 */
export function AppShell() {
  const { can } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const pendingApprovals = usePendingApprovals(can('approve_requests'))

  const groups = navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="min-h-dvh bg-canvas min-[901px]:grid min-[901px]:grid-cols-[288px_minmax(0,1fr)]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-[10px] bg-accent-solid px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          'sticky top-0 z-30 flex flex-col border-line bg-raised',
          'max-[900px]:border-b max-[900px]:px-4 max-[900px]:py-3',
          'min-[901px]:h-dvh min-[901px]:gap-6 min-[901px]:border-r min-[901px]:px-4 min-[901px]:py-6',
        )}
      >
        <div className="flex items-center gap-3 px-1">
          <BrandMark />
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="panel-nav"
            aria-label={menuOpen ? 'Cerrar el menú' : 'Abrir el menú'}
            className="ml-auto flex size-11 items-center justify-center rounded-[10px] border border-line-strong text-ink min-[901px]:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>

        <div
          id="panel-nav"
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-4',
            'max-[900px]:max-h-[calc(100dvh-4.5rem)] max-[900px]:overflow-y-auto max-[900px]:pt-4',
            !menuOpen && 'max-[900px]:hidden',
          )}
        >
          <nav aria-label="Panel" className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <span className="section-label px-3 pb-1.5">{group.label}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm transition-colors',
                        isActive
                          ? 'bg-accent-soft font-semibold text-accent'
                          : 'font-medium text-ink-soft hover:bg-inset hover:text-ink',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0 opacity-80" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/aprobaciones' && !!pendingApprovals.data && (
                      <span className="tabular rounded-full bg-accent-solid px-2 py-px text-[12px] font-semibold text-white">
                        {pendingApprovals.data > 99 ? '99+' : pendingApprovals.data}
                        <span className="sr-only"> pendientes</span>
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="border-t border-line pt-3">
            <UserMenu side="top" />
          </div>
        </div>
      </aside>

      <main
        id="contenido"
        tabIndex={-1}
        className="flex min-w-0 flex-col gap-6 px-4 py-5 outline-none min-[901px]:px-10 min-[901px]:py-8"
      >
        <Outlet />
      </main>
    </div>
  )
}
