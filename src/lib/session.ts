import type { AuthMode } from './env'

/**
 * Sesión del panel. En SSO son los tokens de INTECHSYS ONE; en desarrollo, el token literal
 * dev:<correo> que acepta el API en modo Development. La empresa elegida viaja en X-Tenant-Id.
 */
export interface Session {
  mode: AuthMode
  accessToken: string
  refreshToken?: string | null
  email: string
  fullName?: string | null
  tenantId?: string | null
}

const KEY = 'worklog.session'

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    return parsed?.accessToken ? parsed : null
  } catch {
    return null
  }
}

export const sessionStore = {
  key: KEY,
  get: read,
  save(session: Session) {
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* almacenamiento bloqueado: la sesión vive solo en memoria de esta pestaña */
    }
    listeners.forEach((listener) => listener(session))
  },
  update(patch: Partial<Session>) {
    const current = read()
    if (current) sessionStore.save({ ...current, ...patch })
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* nada que borrar */
    }
    listeners.forEach((listener) => listener(null))
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
