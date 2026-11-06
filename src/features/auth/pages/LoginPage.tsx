import { useEffect } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Code2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineMessage } from '@/components/ui/Primitives'
import { isDevelopmentAuth } from '@/lib/env'
import { canSignInSilently, justSignedOut, markAutomaticAttempt, ssoAvailable, startSso } from '@/lib/sso'
import { useAuth } from '@/providers/AuthProvider'
import { AuthLayout } from '../components/AuthLayout'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido, p. ej. nombre@empresa.com.'),
})

type FormValues = z.infer<typeof schema>

/** Destino tras entrar: la ruta que pidió el usuario, si venía de una protegida. */
function useReturnTo() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  return state?.from && state.from !== '/login' ? state.from : '/'
}

export function LoginPage() {
  const { status } = useAuth()
  const returnTo = useReturnTo()

  if (status !== 'anonymous') return <Navigate to={returnTo} replace />

  return isDevelopmentAuth ? <DevelopmentLogin /> : <SsoLogin />
}

function DevelopmentLogin() {
  const { signInDevelopment } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: 'admin@intechsys.dev' } })

  return (
    <AuthLayout
      title="Entrar en modo desarrollo"
      description="El API en modo Development acepta el token literal dev:<correo>. No hay contraseña ni refresco."
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit((values) => signInDevelopment(values.email))} noValidate>
        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          leading={<Code2 className="size-4" />}
          error={errors.email?.message}
          hint="El administrador de pruebas es admin@intechsys.dev."
          {...register('email')}
        />
        <Button type="submit" variant="primary" size="lg" icon={<LogIn className="size-4" aria-hidden />}>
          Entrar
        </Button>
      </form>
      <InlineMessage tone="warning">
        Este acceso solo existe con <code className="font-semibold">VITE_AUTH_MODE=development</code>. En producción se
        entra con INTECHSYS ONE.
      </InlineMessage>
    </AuthLayout>
  )
}

function SsoLogin() {
  const [params] = useSearchParams()
  const tenant = params.get('tenant')
  const silent = canSignInSilently()

  // Quien llega sin haber salido viene a usar el panel: si tiene sesión en ONE entra sin escribir nada.
  useEffect(() => {
    if (!silent) return
    markAutomaticAttempt()
    void startSso(tenant)
  }, [silent, tenant])

  if (!ssoAvailable()) {
    return (
      <AuthLayout title="Falta configurar el acceso">
        <InlineMessage tone="error">
          Define <code>VITE_ONE_URL</code> y <code>VITE_ONE_PORTAL_URL</code> para entrar con INTECHSYS ONE, o usa{' '}
          <code>VITE_AUTH_MODE=development</code> en local.
        </InlineMessage>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={silent ? 'Conectando con INTECHSYS ONE…' : 'Bienvenido a WorkLog'}
      description="Entra con tu cuenta de INTECHSYS ONE. Es la misma de las demás aplicaciones de tu empresa."
    >
      <Button
        variant="primary"
        size="lg"
        loading={silent}
        icon={<ArrowRight className="size-4" aria-hidden />}
        onClick={() => void startSso(tenant, justSignedOut())}
      >
        Entrar con INTECHSYS ONE
      </Button>
    </AuthLayout>
  )
}
