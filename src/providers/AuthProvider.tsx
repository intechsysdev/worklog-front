import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, setSessionExpiredHandler } from '@/lib/api'
import { isDevelopmentAuth } from '@/lib/env'
import { allows, type PermissionRule } from '@/lib/permissions'
import { queryClient } from '@/lib/queryClient'
import { keys } from '@/lib/queries'
import { sessionStore, type Session } from '@/lib/session'
import { markSignedOut, revokeSession } from '@/lib/sso'
import type { MyProfile, TenantAccess } from '@/lib/types'

export type AuthStatus =
  /** Sin sesión: hay que entrar. */
  | 'anonymous'
  /** Cargando empresas o perfil. */
  | 'loading'
  /** Pertenece a varias empresas y aún no eligió. */
  | 'select-tenant'
  /** El API respondió 403: no está invitado a WorkLog en esa empresa. */
  | 'no-access'
  | 'error'
  | 'ready'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: MyProfile | null
  tenants: TenantAccess[]
  error: ApiError | Error | null
  can: (rule?: PermissionRule) => boolean
  signInDevelopment: (email: string) => void
  selectTenant: (tenantId: string) => void
  signOut: () => Promise<void>
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => sessionStore.get())

  // La sesión puede cambiar desde otro lado (refresco, expiración, otra pestaña).
  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(setSession)
    const onStorage = (event: StorageEvent) => {
      if (event.key === sessionStore.key) setSession(sessionStore.get())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.clear()
    })
  }, [])

  const tenantsQuery = useQuery({
    queryKey: [...keys.tenants, session?.email ?? ''],
    queryFn: () => api.get<TenantAccess[]>('/me/tenants'),
    enabled: !!session,
    staleTime: 5 * 60_000,
  })

  const tenants = useMemo(() => tenantsQuery.data ?? [], [tenantsQuery.data])

  // Con una sola empresa se elige sola; con varias se pregunta (salvo que ya venga de ONE).
  useEffect(() => {
    if (!session || session.tenantId || tenants.length !== 1) return
    sessionStore.update({ tenantId: tenants[0]!.tenantId })
  }, [session, tenants])

  const tenantKnown = tenants.some((tenant) => tenant.tenantId === session?.tenantId)
  const needsTenant = !!session && tenants.length > 1 && (!session.tenantId || !tenantKnown)
  const tenantsSettled = tenantsQuery.isSuccess || tenantsQuery.isError

  const profileQuery = useQuery({
    queryKey: [...keys.me, session?.tenantId ?? 'auto', session?.email ?? ''],
    queryFn: () => api.get<MyProfile>('/me'),
    enabled: !!session && tenantsSettled && !needsTenant && !(tenants.length === 1 && !session.tenantId),
    staleTime: 5 * 60_000,
  })

  const status: AuthStatus = useMemo(() => {
    if (!session) return 'anonymous'
    if (!tenantsSettled) return 'loading'
    if (needsTenant) return 'select-tenant'
    if (profileQuery.error) {
      return profileQuery.error instanceof ApiError && profileQuery.error.status === 403 ? 'no-access' : 'error'
    }
    if (!profileQuery.data) return 'loading'
    return 'ready'
  }, [session, tenantsSettled, needsTenant, profileQuery.error, profileQuery.data])

  const profile = profileQuery.data ?? null

  const can = useCallback((rule?: PermissionRule) => allows(profile?.permissions, rule), [profile])

  const signInDevelopment = useCallback((email: string) => {
    if (!isDevelopmentAuth) return
    queryClient.clear()
    sessionStore.save({ mode: 'development', accessToken: `dev:${email.trim().toLowerCase()}`, email: email.trim() })
  }, [])

  const selectTenant = useCallback((tenantId: string) => {
    // Los datos de una empresa no deben verse ni un instante en otra.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
    sessionStore.update({ tenantId })
  }, [])

  const signOut = useCallback(async () => {
    await revokeSession()
    if (sessionStore.get()?.mode === 'sso') markSignedOut()
    sessionStore.clear()
    queryClient.clear()
  }, [])

  const retry = useCallback(() => {
    void tenantsQuery.refetch()
    void profileQuery.refetch()
  }, [tenantsQuery, profileQuery])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      tenants,
      error: (profileQuery.error as ApiError | null) ?? null,
      can,
      signInDevelopment,
      selectTenant,
      signOut,
      retry,
    }),
    [status, session, profile, tenants, profileQuery.error, can, signInDevelopment, selectTenant, signOut, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
