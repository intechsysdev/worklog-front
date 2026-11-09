/**
 * Tipos del API de WorkLog. Salen de src/lib/api-schema.ts, que se genera desde
 * docs/openapi.v1.json con `npm run gen:api`; aquí solo se les da un nombre corto. Los null se
 * omiten en el JSON, por eso los campos que los admiten son opcionales. Fechas: DateOnly →
 * "aaaa-mm-dd"; TimeOnly → "hh:mm:ss"; DateTimeOffset → ISO 8601.
 */
import type { components } from './api-schema'

type S = components['schemas']

export type Guid = string

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPrevious?: boolean
  hasNext?: boolean
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────

/** Permisos que entiende el panel (el API los envía como texto). */
export type PermissionKey =
  | 'view_own'
  | 'record_work'
  | 'view_team'
  | 'view_locations'
  | 'approve_requests'
  | 'manage_absences'
  | 'close_periods'
  | 'export_payroll'
  | 'manage_schedules'
  | 'manage_settings'
  | 'manage_users'
  | 'view_audit'

export type MemberUsage = S['MemberUsage']
export type MemberStatus = S['MemberStatus']
export type TenantAccess = S['OneTenantAccess'] & { canAdministrate?: boolean }
export type MyProfile = S['MyProfileDto']

// ── Equipo hoy ──────────────────────────────────────────────────────────────

export type TeamFilter = S['TeamFilter']
export type TeamStatus = S['TeamStatus']
export type DayKind = S['DayKind']
export type GeofenceStatus = S['GeofenceStatus']
export type TeamKpis = S['TeamKpisDto']
export type TeamMemberRow = S['TeamMemberRowDto']
export type TeamToday = S['TeamTodayDto']
export type MemberLocations = S['MemberLocationsDto']
export type LocationPoint = S['LocationPointDto']
export type LocationEvent = S['LocationEvent']

// ── Organización y sitios ───────────────────────────────────────────────────

export type BranchStatus = S['BranchStatus']
export type Branch = S['BranchDto']
export type SaveBranchCommand = S['SaveBranchCommand']
export type WorkGroup = S['WorkGroupDto']
export type SaveWorkGroupCommand = S['SaveWorkGroupCommand']
export type GeofenceShape = S['GeofenceShape']
export type GeoPoint = S['GeoPointDto']
export type WorkSite = S['WorkSiteDto']
export type SaveWorkSiteCommand = S['SaveWorkSiteCommand']

// ── Horarios ────────────────────────────────────────────────────────────────

export type CheckSeverity = S['CheckSeverity']
export type ScheduleCheck = S['ScheduleCheckDto']
export type ScheduleTemplate = S['ScheduleTemplateDto']
export type SaveTemplateCommand = S['SaveTemplateCommand']
export type TemplatePreview = S['TemplatePreviewDto']
export type AssignmentLevel = S['AssignmentLevel']
export type Assignment = S['AssignmentDto']
export type CreateAssignmentCommand = S['CreateAssignmentCommand']
export type CalendarDay = S['CalendarDayDto']
export type MemberCalendar = S['MemberCalendarDto']

// ── Catálogo y órdenes de trabajo ───────────────────────────────────────────

export type TimeClass = S['TimeClass']
export type ObservationPolicy = S['ObservationPolicy']
export type ActivityOutcome = S['ActivityOutcome']
export type Category = S['CategoryDto']
export type ActivityType = S['ActivityTypeDto']
export type OutcomeSetting = S['OutcomeDto']
export type Catalog = S['CatalogDto']
export type SaveCategoryCommand = S['SaveCategoryCommand']
export type SaveActivityTypeCommand = S['SaveActivityTypeCommand']
export type PatchActivityTypeCommand = S['PatchActivityTypeCommand']
export type WorkOrderStatus = S['WorkOrderStatus']
export type WorkOrder = S['WorkOrderDto']
export type SaveWorkOrderCommand = S['SaveWorkOrderCommand']
export type ImportReport = S['ImportReport']

// ── Usuarios y roles ────────────────────────────────────────────────────────

export type Member = S['MemberDto']
export type SaveMemberCommand = S['SaveMemberCommand']
export type RoleKind = S['RoleKind']
export type Role = S['RoleDto']
export type PermissionInfo = S['PermissionDto']

// ── Parámetros ──────────────────────────────────────────────────────────────

export type ParameterLevel = S['ParameterLevel']
export type ParameterRow = S['ParameterRowDto']
export type SetParameterCommand = S['SetParameterCommand']

// ── Fase 2: aprobaciones, horas, cierre, novedades, auditoría, dispositivos ─

export type RequestType = S['RequestType']
export type RequestStatus = S['RequestStatus']
export type AdjustmentTarget = S['AdjustmentTarget']
export type ApprovalRequest = S['RequestDto']
export type ApprovalDetail = S['RequestDetailDto']

export type HoursAlert = S['HoursAlert']
export type Breakdown = S['BreakdownDto']
export type TeamHours = S['TeamHoursDto']
export type TeamHoursRow = S['TeamHoursRowDto']

export type PeriodOption = S['PeriodOptionDto']
export type PayrollSummary = S['PayrollSummaryDto']
export type PayrollRow = S['PayrollRowDto']
export type PayrollMemberStatus = S['PayrollMemberStatus']
export type ClosePeriodCommand = S['ClosePeriodCommand']

export type AbsenceType = S['AbsenceType']
export type AbsenceStatus = S['AbsenceStatus']
export type Absence = S['AbsenceDto']
export type AbsencePreview = S['AbsencePreviewDto']
export type RegisterAbsenceCommand = S['RegisterAbsenceCommand']

export type AuditOrigin = S['AuditOrigin']
export type AuditEvent = S['AuditEventDto']

export type DeviceControlSettings = S['DeviceControlSettingsDto']
export type SaveDeviceControlCommand = S['SaveDeviceControlCommand']
export type OfflinePolicy = S['OfflinePolicy']
export type Verification = S['VerificationDto']
export type DeviceRow = S['DeviceRowDto']
export type OneLink = S['OneLinkDto']
export type SaveOneLinkCommand = S['SaveOneLinkCommand']
