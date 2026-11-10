import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { InlineMessage, KeyValueList, StatusChip } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import type { Member } from '@/lib/types'
import { formatClock } from '@/lib/utils'
import { useLinkOneAccount, useResetAppPassword } from '../api'
import { SecretBox } from './SecretBox'

/** Estado de la contraseña de la app, como lo ve quien administra. */
function appAccess(member: Member, now: Date) {
  if (!member.hasAppPassword) return <StatusChip tone="caution">Sin contraseña</StatusChip>
  if (member.appLockedUntil && new Date(member.appLockedUntil) > now)
    return <StatusChip tone="critical">Bloqueada hasta las {formatClock(member.appLockedUntil)}</StatusChip>
  if (member.mustChangePassword) return <StatusChip tone="caution">Temporal, sin cambiar</StatusChip>
  return <StatusChip tone="positive">Activa</StatusChip>
}

/**
 * Accesos de la persona: los usuarios de la app entran con su contraseña de WorkLog y el panel
 * entra con INTECHSYS ONE. Quien hace las dos cosas tiene ambas cuentas.
 */
export function AccessSection({ member, disabled }: { member: Member; disabled?: boolean }) {
  const reset = useResetAppPassword()
  const link = useLinkOneAccount()
  const [confirming, setConfirming] = useState(false)
  const [secret, setSecret] = useState<{ title: string; description: string; value: string } | null>(null)
  const isApp = member.usage === 'Mobile'

  const resetPassword = () =>
    reset.mutate(member.id, {
      onSuccess: (result) => {
        setConfirming(false)
        setSecret({
          title: 'Contraseña temporal de la app',
          description: `Entrégala a ${member.fullName} por un canal seguro. Solo se muestra ahora; la app le pedirá cambiarla al entrar. Sus sesiones abiertas se cerraron.`,
          value: result.temporaryPassword,
        })
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  const linkOne = () =>
    link.mutate(member.id, {
      onSuccess: (result) => {
        const created = result as Member & { temporaryPassword?: string | null; oneAccountCreated?: boolean | null }
        if (created.temporaryPassword) {
          setSecret({
            title: 'Cuenta del panel en INTECHSYS ONE',
            description: 'Contraseña temporal para entrar al panel web. Solo se muestra ahora; ONE le pedirá cambiarla.',
            value: created.temporaryPassword,
          })
        } else {
          toast.success(created.oneAccountCreated === false ? 'Ya tenía cuenta en ONE: quedó vinculada para el panel.' : 'Cuenta de ONE vinculada.')
        }
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[12px] border border-line p-4">
        <h3 className="section-label">Accesos</h3>
        <KeyValueList
          items={[
            ...(isApp ? [{ label: 'App (WorkLog)', value: appAccess(member, new Date()) }] : []),
            {
              label: 'Panel (ONE)',
              value: member.isLinkedToOne ? <StatusChip tone="positive">Cuenta vinculada</StatusChip> : <span className="text-ink-muted">Sin cuenta</span>,
            },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {isApp && (
            <Button size="sm" icon={<KeyRound className="size-3.5" aria-hidden />} disabled={disabled} onClick={() => setConfirming(true)}>
              {member.hasAppPassword ? 'Restablecer contraseña de la app' : 'Generar contraseña de la app'}
            </Button>
          )}
          {isApp && !member.isLinkedToOne && (
            <Button size="sm" icon={<Monitor className="size-3.5" aria-hidden />} loading={link.isPending} disabled={disabled} onClick={linkOne}>
              Dar acceso al panel
            </Button>
          )}
        </div>
        {isApp && (
          <p className="text-[12px] leading-relaxed text-ink-muted">
            Entra a la app con su correo y la contraseña de WorkLog. Solo necesita cuenta de ONE si también usa el panel web.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={resetPassword}
        loading={reset.isPending}
        tone="primary"
        title={member.hasAppPassword ? '¿Restablecer la contraseña de la app?' : '¿Generar la contraseña de la app?'}
        confirmLabel={member.hasAppPassword ? 'Restablecer' : 'Generar'}
        description={
          <>
            Se genera una contraseña temporal para <strong>{member.fullName}</strong>
            {member.hasAppPassword ? ', se cierran sus sesiones abiertas y la actual deja de servir' : ''}. La app le pedirá cambiarla al entrar.
          </>
        }
      />

      <Modal open={!!secret} onClose={() => setSecret(null)} width="sm" title="Contraseña generada">
        {secret && (
          <div className="flex flex-col gap-3">
            <SecretBox title={secret.title} description={secret.description} value={secret.value} />
            <InlineMessage tone="warning">Cópiala antes de cerrar: no se vuelve a mostrar.</InlineMessage>
          </div>
        )}
      </Modal>
    </>
  )
}
