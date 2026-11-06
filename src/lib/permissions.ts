import type { PermissionKey } from './types'

export type PermissionRule = PermissionKey | PermissionKey[]

/** Un arreglo significa "cualquiera de estos permisos basta" (como RequireAnyPermission del API). */
export function allows(granted: readonly string[] | undefined, rule?: PermissionRule) {
  if (!rule) return true
  if (!granted) return false
  return Array.isArray(rule) ? rule.some((key) => granted.includes(key)) : granted.includes(rule)
}
