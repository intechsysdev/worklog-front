import { useId, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InlineMessage } from '@/components/ui/Primitives'
import { ApiError, errorMessage } from '@/lib/api'
import type { ImportReport } from '@/lib/types'
import { cn, downloadText, formatNumber, toDateOnly } from '@/lib/utils'
import { useImportWorkOrders } from '../api'

const MAX_BYTES = 2 * 1024 * 1024

/** Plantilla con el encabezado que entiende el API (separado por punto y coma, como lo abre Excel en español). */
function templateCsv(activityName: string, siteName: string) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = toDateOnly(tomorrow)
  return [
    'numero;actividad;sitio;tecnico;fecha;hora;notas',
    `OT-2001;${activityName};${siteName};tecnico@empresa.com;${date};08:00;Llevar el equipo de repuesto`,
    `OT-2002;${activityName};;;${date};;Sin técnico ni sitio: queda por asignar`,
  ].join('\r\n')
}

export function ImportDialog({
  open,
  onClose,
  sampleActivity,
  sampleSite,
}: {
  open: boolean
  onClose: () => void
  sampleActivity?: string
  sampleSite?: string
}) {
  const importer = useImportWorkOrders()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const pick = (candidate: File | undefined) => {
    setReport(null)
    setFileError(null)
    if (!candidate) return
    if (!/\.(csv|txt)$/i.test(candidate.name)) {
      setFileError('El archivo debe ser .csv.')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setFileError('El archivo pesa más de 2 MB. Divídelo en partes.')
      return
    }
    setFile(candidate)
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  const upload = async () => {
    if (!file) return
    try {
      const result = await importer.mutateAsync(file)
      setReport(result)
      if (result.errors.length === 0) toast.success(`Importación lista: ${result.created} nuevas, ${result.updated} actualizadas.`)
      else toast.warning(`Importación con ${result.errors.length} líneas con error.`)
    } catch (error) {
      setFileError(error instanceof ApiError && error.fieldErrors?.file?.[0] ? error.fieldErrors.file[0] : errorMessage(error))
    }
  }

  const close = () => {
    if (importer.isPending) return
    setFile(null)
    setReport(null)
    setFileError(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      locked={importer.isPending}
      width="lg"
      title="Importar órdenes de trabajo"
      description="Sube un CSV con encabezado. Una OT con un número que ya existe se actualiza; las líneas con error no detienen el resto."
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            icon={<Download className="size-4" aria-hidden />}
            onClick={() => downloadText('plantilla-ordenes-de-trabajo.csv', templateCsv(sampleActivity ?? 'Instalación de equipo', sampleSite ?? 'Almacén Norte'))}
          >
            Descargar plantilla
          </Button>
          <Button variant="ghost" onClick={close} disabled={importer.isPending}>
            {report ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} loading={importer.isPending} disabled={!file} onClick={() => void upload()}>
            {report ? 'Importar de nuevo' : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* La zona de arrastre repite al input de archivo, que sigue siendo accesible con teclado. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-ink-subtle hover:bg-inset',
          )}
        >
          <FileSpreadsheet className="size-7 text-ink-muted" aria-hidden />
          {file ? (
            <span className="text-sm">
              <strong className="font-semibold text-ink">{file.name}</strong>{' '}
              <span className="text-ink-muted">· {formatNumber(Math.ceil(file.size / 1024))} KB</span>
            </span>
          ) : (
            <span className="text-sm text-ink-soft">
              <strong className="font-semibold text-accent">Elige un archivo</strong> o arrástralo aquí
            </span>
          )}
          <span className="text-[13px] text-ink-muted">
            Columnas: numero, actividad, sitio, tecnico (correo), fecha (aaaa-mm-dd), hora (hh:mm), notas. Separado por coma o punto y
            coma. Máximo 2.000 líneas.
          </span>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              pick(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>

        {fileError && <InlineMessage tone="error">{fileError}</InlineMessage>}

        {report && (
          <section aria-labelledby="import-report-title" className="flex flex-col gap-3">
            <h3 id="import-report-title" className="sr-only">
              Resultado de la importación
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Nuevas', value: report.created, tone: 'text-positive' },
                { label: 'Actualizadas', value: report.updated, tone: 'text-ink' },
                { label: 'Con error', value: report.errors.length, tone: report.errors.length ? 'text-caution' : 'text-ink' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5 rounded-[12px] bg-inset p-3">
                  <span className="text-[13px] text-ink-muted">{item.label}</span>
                  <span className={cn('tabular text-2xl font-bold', item.tone)}>{formatNumber(item.value)}</span>
                </div>
              ))}
            </div>

            {report.errors.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-[12px] border border-line">
                <table className="w-full text-sm">
                  <caption className="sr-only">Líneas con error</caption>
                  <thead className="sticky top-0 bg-raised">
                    <tr>
                      <th scope="col" className="w-20 px-4 py-2 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                        Línea
                      </th>
                      <th scope="col" className="px-4 py-2 text-left text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
                        Qué pasó
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.map((error, index) => (
                      <tr key={`${error.line}-${index}`} className="border-t border-divider">
                        <td className="tabular px-4 py-2 font-semibold text-ink">{error.line}</td>
                        <td className="px-4 py-2 text-ink-soft">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <InlineMessage tone="success">Todas las líneas se importaron sin errores.</InlineMessage>
            )}
          </section>
        )}
      </div>
    </Modal>
  )
}
