import type { ReactNode } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'

/** Marco de las pantallas sin sesión: tarjeta centrada con la marca. */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-8">
        <BrandMark className="justify-center" />
        <section className="surface-card flex flex-col gap-6 p-6 sm:p-8" aria-labelledby="auth-title">
          <div className="flex flex-col gap-1.5">
            <h1 id="auth-title" className="text-2xl font-bold text-ink">
              {title}
            </h1>
            {description && <p className="text-[15px] leading-relaxed text-ink-muted">{description}</p>}
          </div>
          {children}
        </section>
        <p className="text-center text-[12px] text-ink-muted">INTECHSYS ONE · WorkLog</p>
      </div>
    </main>
  )
}
