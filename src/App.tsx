import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Compass, Loader2, ShieldOff } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { allNavItems } from '@/components/layout/nav'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Primitives'
import { AuthGate } from '@/features/auth/components/AuthGate'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { SsoCallbackPage, SsoStartPage } from '@/features/auth/pages/SsoPages'
import type { PermissionRule } from '@/lib/permissions'
import { useAuth } from '@/providers/AuthProvider'

// Cada módulo se descarga al entrar en él; el de sitios arrastra MapLibre (~1 MB).
const TeamTodayPage = lazy(() => import('@/features/team/pages/TeamTodayPage'))
const ActivityLogPage = lazy(() => import('@/features/activity-log/pages/ActivityLogPage'))
const OrganizationPage = lazy(() => import('@/features/organization/pages/OrganizationPage'))
const SitesPage = lazy(() => import('@/features/sites/pages/SitesPage'))
const TemplatesPage = lazy(() => import('@/features/schedules/pages/TemplatesPage'))
const AssignmentsPage = lazy(() => import('@/features/schedules/pages/AssignmentsPage'))
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage'))
const WorkOrdersPage = lazy(() => import('@/features/work-orders/pages/WorkOrdersPage'))
const UsersPage = lazy(() => import('@/features/members/pages/UsersPage'))
const ParametersPage = lazy(() => import('@/features/parameters/pages/ParametersPage'))
const ApprovalsPage = lazy(() => import('@/features/approvals/pages/ApprovalsPage'))
const TeamHoursPage = lazy(() => import('@/features/hours/pages/TeamHoursPage'))
const ClosingPage = lazy(() => import('@/features/payroll/pages/ClosingPage'))
const AbsencesPage = lazy(() => import('@/features/absences/pages/AbsencesPage'))
const AuditPage = lazy(() => import('@/features/audit/pages/AuditPage'))
const DeviceControlPage = lazy(() => import('@/features/devices/pages/DeviceControlPage'))

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status">
      <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
      <span className="sr-only">Cargando</span>
    </div>
  )
}

/** Oculta la pantalla si el rol no tiene el permiso (el menú ya no la muestra). */
function Guard({ permission, children }: { permission: PermissionRule; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <section className="surface-card">
        <EmptyState
          icon={<ShieldOff className="size-5" />}
          title="Tu rol no tiene acceso a esta pantalla"
          description="Si crees que deberías verla, pide a un administrador que revise tus permisos en Usuarios y roles."
          action={<LinkButton to="/">Ir al inicio</LinkButton>}
        />
      </section>
    )
  }
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

/** "/" lleva a la primera pantalla que el rol puede ver. */
function Home() {
  const { can } = useAuth()
  const first = allNavItems.find((item) => item.permission && can(item.permission))
  if (first) return <Navigate to={first.to} replace />
  return (
    <>
      <PageHeader title="WorkLog" description="Bitácora de actividades" />
      <section className="surface-card">
        <EmptyState
          icon={<ShieldOff className="size-5" />}
          title="Tu rol no tiene pantallas en el panel web"
          description="Tu cuenta está pensada para la app móvil. Si necesitas el panel, pide a un administrador que cambie tu rol."
        />
      </section>
    </>
  )
}

function NotFound() {
  return (
    <section className="surface-card">
      <EmptyState
        icon={<Compass className="size-5" />}
        title="Esta página no existe"
        description="Revisa la dirección o vuelve al inicio del panel."
        action={<LinkButton to="/">Ir al inicio</LinkButton>}
      />
    </section>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sso" element={<SsoStartPage />} />
      <Route path="/sso/callback" element={<SsoCallbackPage />} />

      <Route element={<AuthGate />}>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="equipo" element={<Guard permission="view_team"><TeamTodayPage /></Guard>} />
          <Route path="registro" element={<Guard permission="view_team"><ActivityLogPage /></Guard>} />
          <Route path="ordenes" element={<Guard permission={['manage_settings', 'view_team']}><WorkOrdersPage /></Guard>} />
          <Route path="organizacion" element={<Guard permission="manage_settings"><OrganizationPage /></Guard>} />
          <Route path="plantillas" element={<Guard permission="manage_schedules"><TemplatesPage /></Guard>} />
          <Route path="asignaciones" element={<Guard permission="manage_schedules"><AssignmentsPage /></Guard>} />
          <Route path="parametros" element={<Guard permission="manage_settings"><ParametersPage /></Guard>} />
          <Route path="actividades" element={<Guard permission="manage_settings"><CatalogPage /></Guard>} />
          <Route path="sitios" element={<Guard permission="manage_settings"><SitesPage /></Guard>} />
          <Route path="usuarios" element={<Guard permission="manage_users"><UsersPage /></Guard>} />

          <Route path="aprobaciones" element={<Guard permission="approve_requests"><ApprovalsPage /></Guard>} />
          <Route path="horas" element={<Guard permission="view_team"><TeamHoursPage /></Guard>} />
          <Route path="cierre" element={<Guard permission={['close_periods', 'export_payroll']}><ClosingPage /></Guard>} />
          <Route path="novedades" element={<Guard permission="manage_absences"><AbsencesPage /></Guard>} />
          <Route path="auditoria" element={<Guard permission="view_audit"><AuditPage /></Guard>} />
          <Route path="dispositivos" element={<Guard permission="manage_settings"><DeviceControlPage /></Guard>} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
