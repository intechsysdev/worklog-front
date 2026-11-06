const trim = (value: string | undefined) => (value ?? '').trim().replace(/\/+$/, '')

/** Configuración de la app, leída una sola vez de las variables VITE_*. */
export const env = {
  apiUrl: trim(import.meta.env.VITE_API_URL),
  oneUrl: trim(import.meta.env.VITE_ONE_URL),
  onePortalUrl: trim(import.meta.env.VITE_ONE_PORTAL_URL),
  oneClientId: (import.meta.env.VITE_ONE_CLIENT_ID ?? 'worklog').trim() || 'worklog',
  authMode: (import.meta.env.VITE_AUTH_MODE ?? 'sso').trim().toLowerCase() === 'development' ? 'development' : 'sso',
} as const

export type AuthMode = (typeof env)['authMode']

export const isDevelopmentAuth = env.authMode === 'development'
