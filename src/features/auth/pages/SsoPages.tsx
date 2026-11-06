import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineMessage } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { completeSso, ssoAvailable, startSso } from '@/lib/sso'
import { AuthLayout } from '../components/AuthLayout'

function Working({ text }: { text: string }) {
  return (
    <AuthLayout title={text}>
      <div className="flex items-center gap-3 text-sm text-ink-muted" role="status">
        <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        Un momento, por favor.
      </div>
    </AuthLayout>
  )
}

/** /sso: arranca el flujo PKCE y manda al portal de ONE (acepta ?tenant= desde el lanzador de ONE). */
export function SsoStartPage() {
  const [params] = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !ssoAvailable()) return
    started.current = true
    void startSso(params.get('tenant'))
  }, [params])

  if (!ssoAvailable()) {
    return (
      <AuthLayout title="El inicio de sesión único no está configurado">
        <InlineMessage tone="error">Faltan VITE_ONE_URL y VITE_ONE_PORTAL_URL.</InlineMessage>
        <Link to="/login" className="font-semibold text-accent">
          Volver
        </Link>
      </AuthLayout>
    )
  }

  return <Working text="Conectando con INTECHSYS ONE…" />
}

/** /sso/callback: valida el state y canjea el código por los tokens de ONE. */
export function SsoCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const handled = useRef(false)

  useEffect(() => {
    // StrictMode monta dos veces: el código es de un solo uso.
    if (handled.current) return
    handled.current = true

    completeSso(params)
      .then(() => navigate('/', { replace: true }))
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [params, navigate])

  if (!error) return <Working text="Terminando de entrar…" />

  return (
    <AuthLayout title="No pudimos completar el inicio de sesión">
      <InlineMessage tone="error">{error}</InlineMessage>
      <Button variant="primary" size="lg" onClick={() => void startSso(null)}>
        Intentar de nuevo
      </Button>
    </AuthLayout>
  )
}
