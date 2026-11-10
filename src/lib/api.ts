import { env } from './env'
import { sessionStore } from './session'

/**
 * Error de la API ya traducido a algo que la interfaz puede mostrar. El API responde con
 * ProblemDetails: `detail` es el mensaje, `errors` trae los errores por campo y `code` es un
 * identificador estable (p. ej. "branch.name_taken") para reaccionar sin leer el texto.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly fieldErrors?: Record<string, string[]>
  readonly payload?: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    options: { code?: string; fieldErrors?: Record<string, string[]>; payload?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options.code
    this.fieldErrors = options.fieldErrors
    this.payload = options.payload
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }
}

/** Mensaje para un toast a partir de cualquier error. */
export function errorMessage(error: unknown, fallback = 'No se pudo completar la acción.') {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.'
  if (error instanceof Error && error.message) return error.message
  return fallback
}

type SessionExpiredHandler = () => void
let onSessionExpired: SessionExpiredHandler = () => {}

export function setSessionExpiredHandler(handler: SessionExpiredHandler) {
  onSessionExpired = handler
}

/**
 * Refresco en curso, compartido por todas las peticiones que fallan a la vez: el token de
 * refresco de ONE rota, y N rotaciones simultáneas invalidarían a las anteriores (y reutilizar
 * uno ya rotado revoca todas las sesiones).
 */
let refreshInFlight: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  const session = sessionStore.get()
  if (!session || session.mode !== 'sso' || !session.refreshToken || !env.oneUrl) {
    return Promise.resolve(null)
  }

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${env.oneUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })
      if (!response.ok) return null

      const data = (await response.json()) as { accessToken: string; refreshToken: string }
      sessionStore.update({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return data.accessToken
    } catch {
      return null
    } finally {
      // Se libera en el siguiente tick para que quienes esperan lean el resultado.
      queueMicrotask(() => {
        refreshInFlight = null
      })
    }
  })()

  return refreshInFlight
}

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, QueryValue>
}

export function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${env.apiUrl || window.location.origin}/api/v1${path}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

async function parseError(response: Response): Promise<ApiError> {
  let message = defaultMessage(response.status)
  let fieldErrors: Record<string, string[]> | undefined
  let code: string | undefined
  let payload: Record<string, unknown> | undefined

  try {
    const body = (await response.json()) as Record<string, unknown> | null

    if (body && typeof body === 'object') {
      const detail = typeof body.detail === 'string' ? body.detail : undefined
      const title = typeof body.title === 'string' ? body.title : undefined
      // El modelo de .NET responde "Failed to read parameter…" en inglés: no se muestra tal cual.
      message = detail && !detail.startsWith('Failed to read') ? detail : (title ?? message)
      fieldErrors = body.errors as Record<string, string[]> | undefined
      code = typeof body.code === 'string' ? body.code : undefined
      payload = body
    }
  } catch {
    // Respuesta sin cuerpo JSON: se conserva el mensaje genérico.
  }

  return new ApiError(response.status, message, { code, fieldErrors, payload })
}

function defaultMessage(status: number) {
  if (status === 403) return 'Tu rol no tiene permiso para esta acción.'
  if (status === 404) return 'No encontramos lo que buscas.'
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
  return `El servidor respondió ${status}.`
}

async function send(method: string, path: string, options: RequestOptions, token: string | null) {
  const { body, query, headers, ...rest } = options
  const session = sessionStore.get()
  const finalHeaders = new Headers(headers)
  const isForm = body instanceof FormData

  if (body !== undefined && !isForm) finalHeaders.set('Content-Type', 'application/json')
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
  // Sin la empresa, un usuario de varias no tendría ninguna resuelta y el API no sabría qué mostrar.
  if (session?.tenantId) finalHeaders.set('X-Tenant-Id', session.tenantId)

  return fetch(buildUrl(path, query), {
    ...rest,
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
}

/** Envía con la sesión; un 401 intenta un refresco y, si no hay, cierra la sesión. */
async function authorized(method: string, path: string, options: RequestOptions): Promise<Response> {
  let response = await send(method, path, options, sessionStore.get()?.accessToken ?? null)

  if (response.status === 401) {
    const renewed = await refreshAccessToken()

    if (renewed) {
      response = await send(method, path, options, renewed)
    }

    if (response.status === 401) {
      sessionStore.clear()
      onSessionExpired()
      throw new ApiError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.')
    }
  }

  return response
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await authorized(method, path, options)
  if (!response.ok) throw await parseError(response)

  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T

  const contentType = response.headers.get('content-type') ?? ''
  return (contentType.includes('json') ? JSON.parse(text) : text) as T
}

/** Nombre del archivo según Content-Disposition (filename* en UTF-8 tiene prioridad). */
function fileNameFrom(response: Response, fallback: string) {
  const header = response.headers.get('content-disposition') ?? ''
  const encoded = /filename*=UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/"/g, ''))
    } catch {
      /* nombre mal codificado: se usa el simple */
    }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? fallback
}

const extensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

/** Si el API no manda nombre (sin Content-Disposition), la extensión sale del tipo de contenido. */
function withExtension(name: string, contentType: string) {
  if (/.[a-z0-9]{2,5}$/i.test(name)) return name
  const extension = extensions[contentType.split(';')[0]!.trim()]
  return extension ? `${name}.${extension}` : name
}

/**
 * Descarga un archivo protegido. Se pide con fetch y no con un enlace porque el token viaja en la
 * cabecera: en la URL quedaría en el historial y en los registros del servidor.
 */
async function download(path: string, options: RequestOptions & { fileName?: string } = {}) {
  const { fileName, ...rest } = options
  const response = await authorized('GET', path, rest)
  if (!response.ok) throw await parseError(response)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = withExtension(fileNameFrom(response, fileName ?? 'descarga'), blob.type)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Archivo protegido como blob (para mostrar una foto con el token en la cabecera, no en la URL). */
async function blob(path: string, options: RequestOptions = {}) {
  const response = await authorized('GET', path, options)
  if (!response.ok) throw await parseError(response)
  return response.blob()
}

export const api = {
  download,
  blob,
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
