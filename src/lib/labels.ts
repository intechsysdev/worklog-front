import type { ChipTone } from '@/components/ui/Primitives'
import type {
  AbsenceStatus,
  AbsenceType,
  AdjustmentTarget,
  AssignmentLevel,
  AuditOrigin,
  HoursAlert,
  PayrollMemberStatus,
  RequestStatus,
  RequestType,
  BranchStatus,
  CheckSeverity,
  MemberStatus,
  MemberUsage,
  ParameterLevel,
  RoleKind,
  TeamStatus,
  TimeClass,
  WorkOrderStatus,
} from './types'

interface Meta {
  label: string
  tone: ChipTone
}

/** Chips de estado según la tabla de §6. */
export const teamStatusMeta: Record<TeamStatus, Meta> = {
  InActivity: { label: 'En actividad', tone: 'accent' },
  Paused: { label: 'En pausa', tone: 'neutral' },
  Idle: { label: 'Sin actividad', tone: 'caution' },
  NotStarted: { label: 'Sin iniciar', tone: 'outline' },
  Absence: { label: 'Novedad', tone: 'outline' },
  DayOff: { label: 'Sin turno', tone: 'outline' },
  Closed: { label: 'Jornada cerrada', tone: 'positive' },
}

export const branchStatusMeta: Record<BranchStatus, Meta> = {
  Active: { label: 'Activa', tone: 'positive' },
  Inactive: { label: 'Inactiva', tone: 'neutral' },
  Draft: { label: 'Borrador', tone: 'caution' },
}

export const memberStatusMeta: Record<MemberStatus, Meta> = {
  Active: { label: 'Activo', tone: 'positive' },
  Inactive: { label: 'Inactivo', tone: 'neutral' },
  Invited: { label: 'Invitado', tone: 'caution' },
}

export const memberUsageLabel: Record<MemberUsage, string> = {
  Mobile: 'Usuario móvil',
  WebOnly: 'Solo panel web',
}

export const workOrderStatusMeta: Record<WorkOrderStatus, Meta> = {
  Open: { label: 'Abierta', tone: 'outline' },
  InProgress: { label: 'En curso', tone: 'accent' },
  Completed: { label: 'Completada', tone: 'positive' },
  Incomplete: { label: 'Incompleta', tone: 'caution' },
  Rescheduled: { label: 'Reprogramada', tone: 'caution' },
  Cancelled: { label: 'Cancelada', tone: 'neutral' },
}

export const timeClassLabel: Record<TimeClass, string> = {
  Productive: 'Productivo',
  PaidNonProductive: 'Pagado, no productivo',
  Unproductive: 'Improductivo',
}

export const checkSeverityMeta: Record<CheckSeverity, { label: string; tone: ChipTone }> = {
  Pass: { label: 'Cumple', tone: 'positive' },
  Warning: { label: 'Aviso', tone: 'caution' },
  Fail: { label: 'No cumple', tone: 'critical' },
}

export const assignmentLevelLabel: Record<AssignmentLevel, string> = {
  Member: 'Persona',
  Group: 'Grupo',
  Branch: 'Sede',
}

export const roleKindLabel: Record<RoleKind, string> = {
  Fixed: 'Fijo',
  Base: 'Base',
  Custom: 'Personalizado',
}

export const parameterLevelLabel: Record<ParameterLevel, string> = {
  Global: 'Global',
  Country: 'País',
  Company: 'Empresa',
  Branch: 'Sede',
}

// ── Fase 2 ──────────────────────────────────────────────────────────────────

export const requestTypeLabel: Record<RequestType, string> = {
  RecordAdjustment: 'Ajuste',
  Overtime: 'Horas extra',
  ShiftChange: 'Cambio de turno',
}

export const requestStatusMeta: Record<RequestStatus, Meta> = {
  Pending: { label: 'Pendiente', tone: 'caution' },
  Approved: { label: 'Aprobada', tone: 'positive' },
  Rejected: { label: 'Rechazada', tone: 'neutral' },
  Cancelled: { label: 'Cancelada', tone: 'outline' },
}

export const adjustmentTargetLabel: Record<AdjustmentTarget, string> = {
  WorkdayStart: 'Inicio de jornada',
  WorkdayEnd: 'Fin de jornada',
  ActivityStart: 'Inicio de actividad',
  ActivityEnd: 'Fin de actividad',
}

/** Alertas de Horas del equipo (§1): "Pasó 42 h" en rosa, cerca del tope en ámbar, extra en gris. */
export const hoursAlertMeta: Record<Exclude<HoursAlert, 'None'>, { label: (capHours: number) => string; tone: ChipTone }> = {
  OverCap: { label: (cap) => `Pasó ${cap} h`, tone: 'accent' },
  NearCap: { label: () => 'Cerca del tope', tone: 'caution' },
  OvertimeInUse: { label: () => 'Extra en uso', tone: 'neutral' },
}

export const payrollMemberStatusMeta: Record<PayrollMemberStatus, Meta> = {
  Pending: { label: 'Pendiente', tone: 'caution' },
  Ready: { label: 'Listo', tone: 'positive' },
  Closed: { label: 'Cerrado', tone: 'neutral' },
}

export const absenceTypeLabel: Record<AbsenceType, string> = {
  Vacation: 'Vacaciones',
  SickLeave: 'Incapacidad',
  Leave: 'Licencia',
  Permission: 'Permiso',
  CompensatoryTime: 'Compensatorio',
}

export const absenceStatusMeta: Record<AbsenceStatus, Meta> = {
  Pending: { label: 'Pendiente', tone: 'caution' },
  Approved: { label: 'Aprobada', tone: 'positive' },
  Rejected: { label: 'Rechazada', tone: 'neutral' },
}

/** Origen en Auditoría (§6): Panel rosa, App gris, Sistema ámbar. */
export const auditOriginMeta: Record<AuditOrigin, Meta & { long: string }> = {
  Web: { label: 'Panel web', tone: 'accent', long: 'Panel web · navegador' },
  Mobile: { label: 'App', tone: 'neutral', long: 'App móvil · Android' },
  System: { label: 'Sistema', tone: 'caution', long: 'Proceso automático del servidor' },
}
