import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Contraseña que se muestra una sola vez, con botón para copiarla. */
export function SecretBox({ title, description, value }: { title: string; description: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-[12px] border border-line p-4">
      <h3 className="section-label mb-1">{title}</h3>
      <p className="mb-3 text-sm text-ink-soft">{description}</p>
      <div className="flex items-center gap-2">
        <code className="tabular flex-1 rounded-[10px] bg-inset px-3 py-2 font-mono text-[15px] tracking-wide text-ink">{value}</code>
        <Button
          variant="secondary"
          icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          onClick={() => void copy()}
        >
          {copied ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
    </div>
  )
}
