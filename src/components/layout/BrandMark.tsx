import { cn } from '@/lib/utils'

/** Logo INTECHSYS "one" + separador + "WorkLog / Bitácora de actividades" (§6). */
export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div role="img" aria-label="INTECHSYS ONE" className="flex items-center gap-1.5">
        <img src="/favicon.svg" alt="" width={30} height={31} className="block h-[31px] w-[30px]" />
        <span aria-hidden className="text-[27px] leading-none font-extrabold tracking-[-0.045em] text-wordmark">
          one
        </span>
      </div>
      {!compact && (
        <>
          <span aria-hidden className="h-7 w-px bg-line" />
          <span className="flex flex-col gap-px">
            <span className="text-[15px] leading-tight font-bold text-ink">WorkLog</span>
            <span className="text-[12px] leading-tight text-ink-muted">Bitácora de actividades</span>
          </span>
        </>
      )}
    </div>
  )
}
