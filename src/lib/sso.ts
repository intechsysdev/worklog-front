import { env } from './env'
import { sessionStore } from './session'
import { ApiError } from './api'

/**
 * Entrada con INTECHSYS ONE (inicio de sesión único). Es el flujo "authorization code" de
 * OAuth 2.0 con PKCE, el indicado para una app que corre entera en el navegador y no puede
 * guardar un secreto:
 *
 * 1. /sso genera un verificador al azar y manda al usuario al portal de ONE con su resumen (S256).
 * 2. ONE, que ya tiene la sesión del usuario, lo devuelve a /sso/callback con un código.
 * 3. El código se canjea presentando el verificador, que nunca salió de esta pestaña.
 */

/** El verificador vive en sessionStorage: solo esta pestaña lo conoce, y muere con ella. */
const TRANSACTION_KEY = 'worklog.sso'
/** "Salir" del panel no cierra la sesión del portal: sin esta marca se entraría solo otra vez. */
const SIGNED_OUT_KEY = 'worklog.sso.signed-out'
/** Ya se intentó entrar solo en esta pestaña: si ONE falló, no se rebota en bucle. */
const AUTO_KEY = 'worklog.sso.auto'

interface Transaction {
  verifier: string
  state: string
}

interface SsoTokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt?: string
  user?: { id?: string; email?: string; fullName?: string; name?: string }
  tenantId?: string | null
}

const redirectUri = () => `${window.location.origin}/sso/callback`

function randomString(bytes: number) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function safeSession() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Sin el portal y el API de ONE no hay a dónde mandar al usuario. */
export const ssoAvailable = () => env.onePortalUrl !== '' && env.oneUrl !== ''

export const markSignedOut = () => safeSession()?.setItem(SIGNED_OUT_KEY, '1')
export const justSignedOut = () => safeSession()?.getItem(SIGNED_OUT_KEY) === '1'

/** Quien llega sin haber salido viene a usar el panel: si tiene sesión en ONE, entra sin escribir nada. */
export const canSignInSilently = () =>
  ssoAvailable() && !justSignedOut() && safeSession()?.getItem(AUTO_KEY) == null

export const markAutomaticAttempt = () => safeSession()?.setItem(AUTO_KEY, '1')

export function forgetSignOutMarks() {
  safeSession()?.removeItem(SIGNED_OUT_KEY)
  safeSession()?.removeItem(AUTO_KEY)
}

/**
 * Manda al usuario al portal de ONE. La empresa, si viene, es la que eligió en ONE al abrir la
 * app: se reenvía para que ONE compruebe el acceso y para dejarla elegida aquí.
 */
export async function startSso(tenantId?: string | null, chooseAccount = false) {
  const transaction: Transaction = { verifier: randomString(32), state: randomString(16) }
  safeSession()?.setItem(TRANSACTION_KEY, JSON.stringify(transaction))

  const target = new URL(`${env.onePortalUrl}/autorizar`)
  target.searchParams.set('client_id', env.oneClientId)
  target.searchParams.set('redirect_uri', redirectUri())
  target.searchParams.set('code_challenge', await challengeFor(transaction.verifier))
  target.searchParams.set('code_challenge_method', 'S256')
  target.searchParams.set('state', transaction.state)
  if (tenantId) target.searchParams.set('tenant', tenantId)
  // Quien acaba de salir quizá quiere entrar con otra cuenta: ONE pregunta con cuál seguir.
  if (chooseAccount) target.searchParams.set('prompt', 'select_account')

  // replace: el botón Atrás desde ONE no debe volver a esta página de paso.
  window.location.replace(target.toString())
}

/** Canjea el código que devolvió ONE y deja la sesión guardada. */
export async function completeSso(params: URLSearchParams) {
  const code = params.get('code')
  const state = params.get('state')

  let transaction: Transaction | null = null
  try {
    transaction = JSON.parse(safeSession()?.getItem(TRANSACTION_KEY) ?? 'null') as Transaction | null
  } catch {
    transaction = null
  }
  safeSession()?.removeItem(TRANSACTION_KEY)

  const providerError = params.get('error_description') ?? params.get('error')
  if (providerError) throw new Error(`ONE no autorizó el acceso: ${providerError}`)

  // El state ata la vuelta a la ida desde esta misma pestaña (evita inyectar el código de otro).
  if (!code || !transaction || state !== transaction.state) {
    throw new Error('El inicio de sesión con ONE no se pudo completar. Vuelve a intentarlo desde el principio.')
  }

  const response = await fetch(`${env.oneUrl}/api/v1/sso/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env.oneClientId,
      code,
      codeVerifier: transaction.verifier,
      redirectUri: redirectUri(),
    }),
  })

  if (!response.ok) {
    let message = `ONE respondió ${response.status}.`
    try {
      const body = (await response.json()) as { detail?: string; title?: string; message?: string }
      message = body.detail ?? body.message ?? body.title ?? message
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(response.status, message)
  }

  const data = (await response.json()) as SsoTokenResponse

  sessionStore.save({
    mode: 'sso',
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    email: data.user?.email ?? '',
    fullName: data.user?.fullName ?? data.user?.name ?? null,
    tenantId: data.tenantId ?? params.get('tenant') ?? null,
  })
  forgetSignOutMarks()
}

/**
 * Revoca en ONE el token de refresco. Lee la sesión antes del primer await: quien llama la
 * borra justo después. Sin red no pasa nada: la sesión se cierra igual en el navegador.
 */
export async function revokeSession() {
  const session = sessionStore.get()
  if (!session || session.mode !== 'sso' || !session.refreshToken || !env.oneUrl) return

  try {
    await fetch(`${env.oneUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      keepalive: true,
    })
  } catch {
    /* sin red: el token vence solo */
  }
}
