/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API de WorkLog, sin barra final (p. ej. http://localhost:5290). */
  readonly VITE_API_URL?: string
  /** API de INTECHSYS ONE: canje del código SSO, refresco y cierre de sesión. */
  readonly VITE_ONE_URL?: string
  /** Portal de INTECHSYS ONE, donde vive /autorizar. */
  readonly VITE_ONE_PORTAL_URL?: string
  /** client_id registrado en ONE para esta app. */
  readonly VITE_ONE_CLIENT_ID?: string
  /** "sso" (por defecto) o "development" (token literal dev:<correo>). */
  readonly VITE_AUTH_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
