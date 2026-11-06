import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const controlClass =
  'w-full rounded-[10px] border border-line-strong bg-raised px-3 text-sm text-ink placeholder:text-ink-subtle ' +
  'transition-[border-color,box-shadow] outline-none hover:border-ink-subtle ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-inset disabled:opacity-60'

const invalidClass = 'border-critical focus:border-critical focus:ring-critical/25'

interface FieldShellProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
  action?: ReactNode
  /** Id del texto de ayuda o error, para aria-describedby. */
  describedById?: string
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
  action,
  describedById,
}: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-soft">
              {label}
              {required && (
                <span className="ml-0.5 text-critical" aria-hidden>
                  *
                </span>
              )}
            </label>
          )}
          {action}
        </div>
      )}

      {children}

      {error ? (
        <p id={describedById} role="alert" className="flex items-start gap-1.5 text-[13px] text-critical">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={describedById} className="text-[13px] leading-relaxed text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

interface CommonFieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  wrapperClassName?: string
  action?: ReactNode
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, CommonFieldProps {
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, wrapperClassName, leading, trailing, action, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const describedBy = `${fieldId}-desc`

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={fieldId}
      className={wrapperClassName}
      action={action}
      describedById={describedBy}
    >
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 text-ink-muted" aria-hidden>
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? describedBy : undefined}
          className={cn(controlClass, 'h-10', leading && 'pl-9', trailing && 'pr-10', error && invalidClass, className)}
          {...props}
        />
        {trailing && <span className="absolute right-2 flex items-center">{trailing}</span>}
      </div>
    </FieldShell>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, CommonFieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapperClassName, action, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const describedBy = `${fieldId}-desc`

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={fieldId}
      className={wrapperClassName}
      action={action}
      describedById={describedBy}
    >
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? describedBy : undefined}
        className={cn(controlClass, 'min-h-20 resize-y rounded-[12px] py-2 leading-relaxed', error && invalidClass, className)}
        {...props}
      />
    </FieldShell>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, CommonFieldProps {}

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23868787' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, wrapperClassName, action, id, children, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const describedBy = `${fieldId}-desc`

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={fieldId}
      className={wrapperClassName}
      action={action}
      describedById={describedBy}
    >
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? describedBy : undefined}
        className={cn(
          controlClass,
          'h-10 cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9',
          error && invalidClass,
          className,
        )}
        style={{ backgroundImage: chevron }}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
})

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
  /** Etiqueta accesible cuando el interruptor no tiene texto visible (celdas de tabla). */
  ariaLabel?: string
}

export function Switch({ checked, onChange, label, description, disabled, className, ariaLabel }: SwitchProps) {
  const id = useId()

  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent-solid' : 'bg-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0 size-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )

  if (!label && !description) return <span className={cn('inline-flex', className)}>{control}</span>

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="mt-0.5 inline-flex">{control}</span>
      <span className="flex flex-col gap-0.5">
        {label && (
          <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">
            {label}
          </label>
        )}
        {description && <span className="text-[13px] leading-relaxed text-ink-muted">{description}</span>}
      </span>
    </div>
  )
}
