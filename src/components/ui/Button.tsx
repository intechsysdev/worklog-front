import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-accent-solid text-accent-contrast hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-raised text-ink hover:bg-inset',
  tertiary: 'text-accent hover:bg-accent-soft hover:text-accent-ink',
  ghost: 'text-ink-soft hover:bg-segmented hover:text-ink',
  danger: 'border border-line-strong bg-raised text-critical hover:border-critical hover:bg-critical-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  icon: 'size-10 p-0',
  'icon-sm': 'size-8 p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, icon, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  icon?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  )
}
