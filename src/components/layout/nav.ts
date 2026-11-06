import {
  BarChart3,
  CalendarRange,
  CheckCheck,
  ClipboardList,
  Clock,
  Building2,
  FileClock,
  ListChecks,
  Lock,
  MapPin,
  Palmtree,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionRule } from '@/lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission: PermissionRule
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Menú del panel (§6): grupos Operación y Configuración. Cada item se oculta sin su permiso. */
export const navigation: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/equipo', label: 'Equipo hoy', icon: Users, permission: 'view_team' },
      { to: '/aprobaciones', label: 'Aprobaciones', icon: CheckCheck, permission: 'approve_requests' },
      { to: '/horas', label: 'Horas del equipo', icon: BarChart3, permission: 'view_team' },
      { to: '/cierre', label: 'Cierre de periodo', icon: Lock, permission: ['close_periods', 'export_payroll'] },
      { to: '/ordenes', label: 'Órdenes de trabajo', icon: ClipboardList, permission: ['manage_settings', 'view_team'] },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/organizacion', label: 'Organización', icon: Building2, permission: 'manage_settings' },
      { to: '/plantillas', label: 'Plantillas de horario', icon: Clock, permission: 'manage_schedules' },
      { to: '/asignaciones', label: 'Asignaciones', icon: CalendarRange, permission: 'manage_schedules' },
      { to: '/novedades', label: 'Novedades', icon: Palmtree, permission: 'manage_absences' },
      { to: '/parametros', label: 'Parámetros', icon: SlidersHorizontal, permission: 'manage_settings' },
      { to: '/actividades', label: 'Actividades', icon: ListChecks, permission: 'manage_settings' },
      { to: '/sitios', label: 'Sitios y geocercas', icon: MapPin, permission: 'manage_settings' },
      { to: '/usuarios', label: 'Usuarios y roles', icon: ShieldCheck, permission: 'manage_users' },
      { to: '/dispositivos', label: 'Control de dispositivos', icon: Smartphone, permission: 'manage_settings' },
      { to: '/auditoria', label: 'Auditoría', icon: FileClock, permission: 'view_audit' },
    ],
  },
]

export const allNavItems = navigation.flatMap((group) => group.items)

