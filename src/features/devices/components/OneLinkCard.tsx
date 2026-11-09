import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { KeyRound, Link2, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Card, CardHeader, ErrorState, InlineMessage, KeyValueList, Skeleton, StatusChip } from '@/components/ui/Primitives'
import { ApiError, errorMessage } from '@/lib/api'
import type { OneLink } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useCheckOneLink, useOneLink, useRemoveOneLink, useSaveOneLink } from '../api'

/**
 * Credencial que ONE emite para la empresa en WorkLog. Con ella WorkLog lee las variables de la
 * empresa en ONE (la consola de MobiControl). Vive dentro del formulario de la página, así que no
 * es un <form>: Enter en sus campos vincula en vez de guardar el resto de la página.
 */
export function OneLinkCard() {
  const link = useOneLink()
  const [editing, setEditing] = useState(false)

  return (
    <Card className="flex flex-col gap-4" aria-labelledby="one-link-title">
      <CardHeader
        id="one-link-title"
        title="Vínculo con INTECHSYS ONE"
        description="WorkLog lee la consola de MobiControl con las variables que la empresa tiene en ONE."
      />
      {link.isLoading ? (
        <Skeleton className="h-28 rounded-[12px]" />
      ) : link.isError || !link.data ? (
        <ErrorState message={errorMessage(link.error)} onRetry={() => void link.refetch()} />
      ) : link.data.linked && !editing ? (
        <LinkStatus link={link.data} onChange={() => setEditing(true)} />
      ) : (
        <LinkForm linked={link.data.linked} onDone={() => setEditing(false)} />
      )}
    </Card>
  )
}

function LinkStatus({ link, onChange }: { link: OneLink; onChange: () => void }) {
  const check = useCheckOneLink()
  const remove = useRemoveOneLink()
  const [confirming, setConfirming] = useState(false)

  const runCheck = () =>
    check.mutate(undefined, {
      onSuccess: (result) =>
        toast[result.reachable && result.mobiControlConfigured ? 'success' : 'warning'](
          result.reachable && result.mobiControlConfigured ? 'ONE responde y la consola está configurada.' : 'Hay algo pendiente en ONE.',
        ),
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <>
      <KeyValueList
        items={[
          {
            label: 'ONE',
            value: link.reachable ? (
              <StatusChip tone="positive">Responde · {link.tenantName}</StatusChip>
            ) : (
              <StatusChip tone="caution">Sin respuesta válida</StatusChip>
            ),
          },
          {
            label: 'MobiControl',
            value: link.mobiControlConfigured ? (
              <span className="font-mono text-[13px]">{link.mobiControlHost}</span>
            ) : (
              <StatusChip tone="caution">Variables pendientes</StatusChip>
            ),
          },
          {
            label: 'Credencial',
            value: (
              <span>
                <span className="font-mono text-[13px]">{link.apiKeyHint}</span>
                {link.linkedAt && <span className="text-ink-muted"> · desde {formatDateTime(link.linkedAt)}</span>}
              </span>
            ),
          },
        ]}
      />

      {link.problem && <InlineMessage tone="warning">{link.problem}</InlineMessage>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={check.isPending} onClick={runCheck}>
          Comprobar
        </Button>
        <Button size="sm" icon={<KeyRound className="size-3.5" aria-hidden />} onClick={onChange}>
          Cambiar credencial
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setConfirming(true)}>
          Quitar
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        loading={remove.isPending}
        title="Quitar el vínculo con ONE"
        description="WorkLog dejará de leer la consola de MobiControl de esta empresa hasta que pegues otra credencial."
        confirmLabel="Quitar"
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false)
              toast.success('Se quitó la credencial de ONE.')
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </>
  )
}

function LinkForm({ linked, onDone }: { linked: boolean; onDone: () => void }) {
  const save = useSaveOneLink()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [errors, setErrors] = useState<{ apiKey?: string; apiSecret?: string }>({})

  const submit = () => {
    const missing = {
      apiKey: apiKey.trim() ? undefined : 'Pega la API key.',
      apiSecret: apiSecret.trim() ? undefined : 'Pega el secreto.',
    }
    setErrors(missing)
    if (missing.apiKey || missing.apiSecret) return

    save.mutate(
      { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
      {
        onSuccess: (result) => {
          setApiSecret('')
          toast[result.mobiControlConfigured ? 'success' : 'warning'](
            result.mobiControlConfigured ? 'WorkLog quedó vinculado con ONE.' : 'Vinculado, pero faltan variables de MobiControl en ONE.',
          )
          onDone()
        },
        onError: (error) => {
          // ONE rechaza la credencial (o es de otra empresa): el motivo va junto al campo.
          if (error instanceof ApiError && error.fieldErrors) {
            setErrors({ apiKey: error.fieldErrors.apiKey?.[0], apiSecret: error.fieldErrors.apiSecret?.[0] })
          } else {
            toast.error(errorMessage(error))
          }
        },
      },
    )
  }

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <InlineMessage tone="info">
        En ONE: <strong>Empresas → la empresa → WorkLog → Credenciales</strong>, crea una credencial y pega aquí la API key y el
        secreto. ONE muestra el secreto una sola vez.
      </InlineMessage>
      <Input
        label="API key"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        onKeyDown={onEnter}
        error={errors.apiKey}
        autoComplete="off"
        spellCheck={false}
        className="font-mono text-[13px]"
      />
      <Input
        label="Secreto"
        type="password"
        value={apiSecret}
        onChange={(event) => setApiSecret(event.target.value)}
        onKeyDown={onEnter}
        error={errors.apiSecret}
        autoComplete="new-password"
        hint="Se guarda cifrado y nunca vuelve a mostrarse."
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" icon={<Link2 className="size-3.5" aria-hidden />} loading={save.isPending} onClick={submit}>
          Vincular
        </Button>
        {linked && (
          <Button size="sm" onClick={onDone}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
