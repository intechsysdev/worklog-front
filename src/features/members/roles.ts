import type { MemberUsage, Role } from '@/lib/types'

/** Roles que tienen sentido según cómo usará WorkLog la persona (§1, Invitar usuario). */
const mobileKeys = ['mobile', 'supervisor']
const webKeys = ['supervisor', 'hr', 'payroll', 'admin']

export function rolesForUsage(roles: Role[], usage: MemberUsage) {
  const keys = usage === 'Mobile' ? mobileKeys : webKeys
  return roles.filter((role) => role.kind === 'Custom' || (role.systemKey ? keys.includes(role.systemKey) : true))
}

export const isAdminRole = (role: Role) => role.systemKey === 'admin' || role.kind === 'Fixed'
