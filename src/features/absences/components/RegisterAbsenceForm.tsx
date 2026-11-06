import { useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Controls'
import { FieldShell, Input, Select, Textarea } from '@/components/ui/Field'
import { Card, InlineMessage, Skeleton } from '@/components/ui/Primitives'
import { errorMessage } from '@/lib/api'
import { applyApiErrors } from '@/lib/forms'
import { absenceTypeLabel } from '@/lib/labels'
import type { AbsenceType, RegisterAbsenceCommand } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { todayDateOnly } from '@/lib/utils'
import { useMemberOptions } from '@/features/members/api'
import { useAbsencePreview, useRegisterAbsence, useUploadSupport } from '../api'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

const schema = z
  .object({
    memberId: z.string().min(1, 'Elige el usuario.'),
    type: z.enum(['Vacation', 'SickLeave', 'Leave', 'Permission', 'CompensatoryTime']),
    from: z.string().min(1, 'Elige la fecha de inicio.'),
    to: z.string(),
    fromTime: z.string(),
    toTime: z.string(),
    notes: z.string().trim().max(500, 'Máximo 500 caracteres.'),
  })
  .superRefine((values, context) => {
    if (values.type === 'Permission') {
      if (!values.fromTime) context.addIssue({ code: 'custom', path: ['fromTime'], message: 'Elige la hora de inicio.' })
      if (!values.toTime) context.addIssue({ code: 'custom', path: ['toTime'], message: 'Elige la hora de fin.' })
      if (values.fromTime && values.toTime && values.toTime <= values.fromTime)
        context.addIssue({ code: 'custom', path: ['toTime'], message: 'La hora de fin debe ser posterior a la de inicio.' })
    } else {
      if (!values.to) context.addIssue({ code: 'custom', path: ['to'], message: 'Elige la fecha final.' })
      if (values.to && values.to < values.from) context.addIssue({ code: 'custom', path: ['to'], message: 'La fecha final no puede ser anterior a la inicial.' })
    }
  })

type FormValues = z.infer<typeof schema>
const fields = ['memberId', 'type', 'from', 'to', 'fromTime', 'toTime', 'notes'] as const

function toCommand(values: Partial<FormValues>): RegisterAbsenceCommand | null {
  if (!values.memberId || !values.type || !values.from) return null
  const permission = values.type === 'Permission'
  if (permission && (!values.fromTime || !values.toTime || values.toTime <= values.fromTime)) return null
  if (!permission && (!values.to || values.to < values.from)) return null
  return {
    memberId: values.memberId,
    type: values.type,
    from: values.from,
    to: permission ? values.from : values.to!,
    fromTime: permission ? `${values.fromTime}:00` : null,
    toTime: permission ? `${values.toTime}:00` : null,
    notes: values.notes?.trim() || null,
  }
}

/** "Registrar novedad" (§1, Novedades). Queda Pendiente hasta que alguien con manage_absences la apruebe. */
export function RegisterAbsenceForm() {
  const members = useMemberOptions()
  const register = useRegisterAbsence()
  const upload = useUploadSupport()
  const fileInput = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const {
    register: field,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { memberId: '', type: 'Vacation', from: todayDateOnly(), to: todayDateOnly(), fromTime: '', toTime: '', notes: '' },
  })

  const values = useWatch({ control })
  const type = values.type ?? 'Vacation'
  // Se compara como texto: un objeto nuevo en cada render reiniciaría el retardo sin fin.
  const command = toCommand({ ...values, notes: '' })
  const debounced = JSON.parse(useDebounced(JSON.stringify(command), 300)) as RegisterAbsenceCommand | null
  const preview = useAbsencePreview(debounced)

  const pickFile = (candidate: File | undefined) => {
    setFileError(null)
    if (!candidate) return
    if (!ACCEPT.split(',').includes(candidate.type)) {
      setFileError('El soporte debe ser PDF o una foto (JPG, PNG o WebP).')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setFileError('El archivo pesa más de 10 MB.')
      return
    }
    setFile(candidate)
  }

  const submit = async (form: FormValues) => {
    const body = toCommand(form)
    if (!body) return
    try {
      const created = await register.mutateAsync({ ...body, notes: form.notes.trim() || null })
      if (file) {
        try {
          await upload.mutateAsync({ id: created.id, file })
        } catch (error) {
          toast.error(`La novedad quedó registrada, pero el soporte no se pudo subir: ${errorMessage(error)}`)
        }
      }
      toast.success(`Novedad registrada para ${created.memberName}: queda pendiente${file ? '' : ' y sin soporte'}.`)
      reset({ memberId: '', type: form.type, from: todayDateOnly(), to: todayDateOnly(), fromTime: '', toTime: '', notes: '' })
      setFile(null)
    } catch (error) {
      applyApiErrors(error, setError, fields)
    }
  }

  const people = (members.data ?? []).filter((member) => member.status !== 'Inactive')

  return (
    <Card as="aside" className="flex flex-col gap-5 self-start" aria-labelledby="register-absence-title">
      <h2 id="register-absence-title" className="text-lg font-bold text-ink">
        Registrar novedad
      </h2>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(submit)}>
        <Select label="Usuario" required error={errors.memberId?.message} {...field('memberId')}>
          <option value="">Elige el usuario</option>
          {people.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
              {member.branchName ? ` · ${member.branchName}` : ''}
            </option>
          ))}
        </Select>

        <FieldShell label="Tipo">
          <ChipGroup<AbsenceType>
            ariaLabel="Tipo de novedad"
            options={(Object.keys(absenceTypeLabel) as AbsenceType[]).map((value) => ({ value, label: absenceTypeLabel[value] }))}
            value={type}
            onChange={(value) => setValue('type', value, { shouldValidate: false })}
          />
        </FieldShell>

        {type === 'Permission' ? (
          <>
            <Input label="Día" type="date" required error={errors.from?.message} {...field('from')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Desde" type="time" required error={errors.fromTime?.message} {...field('fromTime')} />
              <Input label="Hasta" type="time" required error={errors.toTime?.message} {...field('toTime')} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Desde" type="date" required error={errors.from?.message} {...field('from')} />
            <Input label="Hasta" type="date" required min={values.from} error={errors.to?.message} {...field('to')} />
          </div>
        )}

        <Textarea label="Notas" rows={2} placeholder="Opcional" error={errors.notes?.message} {...field('notes')} />

        <div className="flex flex-col gap-1.5">
          <input
            id={fileId}
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              pickFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-sm">
              <Paperclip className="size-4 text-ink-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Quitar soporte" onClick={() => setFile(null)}>
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : (
            <Button icon={<Paperclip className="size-4" aria-hidden />} onClick={() => fileInput.current?.click()} className="self-start">
              Adjuntar soporte (PDF o foto)
            </Button>
          )}
          {fileError && (
            <p role="alert" className="text-[13px] text-critical">
              {fileError}
            </p>
          )}
        </div>

        <div aria-live="polite">
          {!debounced ? null : preview.isError ? (
            <InlineMessage tone="error">{errorMessage(preview.error)}</InlineMessage>
          ) : preview.data ? (
            <InlineMessage tone="info" className={preview.isFetching ? 'opacity-70' : undefined}>
              {preview.data.message}
            </InlineMessage>
          ) : (
            <Skeleton className="h-12 rounded-[12px]" />
          )}
        </div>

        <Button type="submit" variant="primary" loading={isSubmitting} disabled={preview.isError}>
          Registrar
        </Button>
      </form>
    </Card>
  )
}
