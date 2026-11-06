/**
 * Claves de caché centralizadas. Todas empiezan por el recurso para poder invalidar por prefijo
 * (p. ej. keys.branches.all invalida la lista y cualquier variante filtrada).
 */
export const keys = {
  me: ['me'] as const,
  tenants: ['me', 'tenants'] as const,

  teamToday: (params: unknown) => ['team-today', params] as const,

  branches: { all: ['branches'] as const },
  groups: { all: ['groups'] as const, list: (branchId?: string) => ['groups', branchId ?? 'all'] as const },
  sites: { all: ['sites'] as const, list: (includeInactive: boolean) => ['sites', includeInactive] as const },

  templates: { all: ['templates'] as const },
  assignments: { all: ['assignments'] as const },
  calendar: (memberId: string, year: number, month: number) => ['calendar', memberId, year, month] as const,

  catalog: ['catalog'] as const,

  workOrders: { all: ['work-orders'] as const, list: (params: unknown) => ['work-orders', params] as const },

  members: {
    all: ['members'] as const,
    list: (params: unknown) => ['members', 'list', params] as const,
    detail: (id: string) => ['members', 'detail', id] as const,
    options: ['members', 'options'] as const,
  },
  roles: ['roles'] as const,
  permissions: ['roles', 'permissions'] as const,

  parameters: (level: string, scope?: string) => ['parameters', level, scope ?? ''] as const,
}
