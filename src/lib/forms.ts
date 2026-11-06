import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError, errorMessage } from './api'

/** Clave de ProblemDetails.errors → nombre de campo del formulario ("$.Name" → "name"). */
function normalizeKey(key: string) {
  const clean = key.replace(/^\$\.?/, '').split(/[.[]/)[0] ?? ''
  return clean.charAt(0).toLowerCase() + clean.slice(1)
}

/**
 * Lleva los errores por campo del API al formulario. Lo que no corresponde a ningún campo
 * visible (o un error sin `errors`) se muestra en un toast con el `detail`.
 *
 * @param fields  campos que existen en el formulario.
 * @param aliases nombre del API → nombre del formulario cuando difieren.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  aliases: Record<string, string> = {},
) {
  if (!(error instanceof ApiError) || !error.fieldErrors) {
    toast.error(errorMessage(error))
    return
  }

  let mapped = 0
  for (const [rawKey, messages] of Object.entries(error.fieldErrors)) {
    const key = aliases[normalizeKey(rawKey)] ?? normalizeKey(rawKey)
    if (fields.includes(key) && messages[0]) {
      setError(key as Path<T>, { type: 'server', message: messages[0] }, { shouldFocus: mapped === 0 })
      mapped++
    }
  }

  if (mapped === 0) toast.error(error.message)
}

/** Primer error de un campo concreto (para formularios que no usan react-hook-form). */
export function fieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError) || !error.fieldErrors) return undefined
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    if (normalizeKey(key) === field) return messages[0]
  }
  return undefined
}
