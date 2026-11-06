import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Building2, ChevronRight, Loader2, LogOut, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'
import { AuthLayout } from './AuthLayout'

/**
 * Protege el panel: sin sesión manda al login; con varias empresas pide elegir una; sin acceso
 * a WorkLog lo explica. Solo con el perfil cargado deja pasar al shell.
 */
export function AuthGate() {
  const { status, tenants, selectTenant, signOut, error, retry, session } = useAuth()
  const location = useLocation()

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
        <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
        <span className="sr-only">Cargando tu perfil</span>
      </div>
    )
  }

  if (status === 'select-tenant') {
    return (
      <AuthLayout title="¿Con qué empresa vas a trabajar?" description="Tienes acceso a WorkLog en varias empresas. Puedes cambiar luego desde tu menú.">
        <ul className="flex flex-col gap-2">
          {tenants.map((tenant) => (
            <li key={tenant.tenantId}>
              <button
                type="button"
                onClick={() => selectTenant(tenant.tenantId)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-line p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-segmented text-ink-soft" aria-hidden>
                  <Building2 className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{tenant.name}</span>
                  {tenant.role && <span className="text-[13px] text-ink-muted">Rol en ONE: {tenant.role}</span>}
                </span>
                <ChevronRight className="size-4 text-ink-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" icon={<LogOut className="size-4" aria-hidden />} onClick={() => void signOut()}>
          Salir
        </Button>
      </AuthLayout>
    )
  }

  if (status === 'no-access' || status === 'error') {
    return (
      <AuthLayout
        title={status === 'no-access' ? 'No tienes acceso a WorkLog' : 'No pudimos cargar tu perfil'}
        description={session?.email}
      >
        <InlineMessage tone="error">{errorMessage(error)}</InlineMessage>
        <div className="flex flex-wrap gap-2">
          {status === 'error' && (
            <Button variant="primary" icon={<RotateCw className="size-4" aria-hidden />} onClick={retry}>
              Reintentar
            </Button>
          )}
          {tenants.length > 1 && (
            <Button onClick={() => selectTenant('')} icon={<Building2 className="size-4" aria-hidden />}>
              Elegir otra empresa
            </Button>
          )}
          <Button variant="ghost" icon={<LogOut className="size-4" aria-hidden />} onClick={() => void signOut()}>
            Salir
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return <Outlet />
}
