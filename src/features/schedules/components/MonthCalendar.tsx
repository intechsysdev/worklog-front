import type { CalendarDay, DayKind } from '@/lib/types'
import { cn, formatClock, parseDateOnly } from '@/lib/utils'
import { hoursText } from '../weekdays'

const weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const cellStyle: Record<DayKind, string> = {
  Shift: 'border border-accent-solid bg-accent-soft',
  Absence: 'border border-caution-dot bg-caution-soft',
  Override: 'border-2 border-dashed border-ink-soft bg-raised',
  Holiday: 'border border-transparent bg-segmented',
  Rest: 'border border-transparent bg-segmented',
  Unscheduled: 'border border-line bg-raised',
}

function describe(day: CalendarDay): { title: string; sub: string } {
  const hours = day.scheduledMinutes > 0 ? hoursText(day.scheduledMinutes) : ''
  const range = day.start && day.end ? `${formatClock(day.start)}–${formatClock(day.end)}` : ''
  switch (day.kind) {
    case 'Shift':
      return { title: day.templateName ?? day.label ?? 'Turno', sub: [range, hours].filter(Boolean).join(' · ') }
    case 'Absence':
      return { title: day.label ?? 'Novedad', sub: 'Novedad aprobada' }
    case 'Override':
      return { title: 'Cambio', sub: [range, hours].filter(Boolean).join(' · ') || (day.label ?? '') }
    case 'Holiday':
      return { title: day.label ?? 'Festivo', sub: 'Festivo' }
    case 'Rest':
      return { title: 'Descanso', sub: '' }
    case 'Unscheduled':
      return { title: 'Sin horario', sub: 'No hay asignación' }
  }
}

const legend = [
  { label: 'Turno', className: 'border border-accent-solid bg-accent-soft' },
  { label: 'Novedad', className: 'border border-caution-dot bg-caution-soft' },
  { label: 'Cambio puntual', className: 'border-2 border-dashed border-ink-soft bg-raised' },
  { label: 'Festivo o descanso', className: 'bg-segmented' },
]

export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-soft" aria-label="Leyenda">
      {legend.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={cn('size-3.5 rounded-[4px]', item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Calendario mensual de 7 columnas (Lun–Dom, 42 celdas). En ≤640 px se vuelve una lista con solo
 * los días del mes y el nombre del día delante.
 */
export function MonthCalendar({ year, month, days }: { year: number; month: number; days: CalendarDay[] }) {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7 // lunes = 0
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month - 1, 1 - offset + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { key, date, inMonth: date.getMonth() === month - 1, day: byDate.get(key) }
  })

  // Si el mes cabe en 5 semanas, la sexta fila vacía sobra.
  const visible = cells.slice(35).every((cell) => !cell.inMonth) ? cells.slice(0, 35) : cells

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:min-w-[560px] sm:grid-cols-7" role="list" aria-label="Días del mes">
        {weekdayNames.map((name) => (
          <span key={name} className="hidden px-1 pb-1 text-[12px] font-semibold tracking-[0.06em] text-ink-muted uppercase sm:block" aria-hidden>
            {name}
          </span>
        ))}
        {visible.map((cell) => {
          if (!cell.inMonth) {
            return <div key={cell.key} className="hidden min-h-[92px] rounded-[10px] bg-inset opacity-45 sm:block" aria-hidden />
          }

          const info = cell.day ? describe(cell.day) : { title: '—', sub: '' }
          const weekday = weekdayNames[(cell.date.getDay() + 6) % 7]
          const isToday = cell.key === todayKey

          return (
            <div
              key={cell.key}
              role="listitem"
              className={cn(
                'flex min-h-[60px] flex-col gap-0.5 rounded-[10px] p-2 text-[12px] sm:min-h-[92px]',
                cell.day ? cellStyle[cell.day.kind] : 'border border-line bg-raised',
                isToday && 'ring-2 ring-ink ring-offset-1 ring-offset-raised',
              )}
            >
              <span className={cn('text-[13px] font-bold text-ink', isToday && 'text-accent')}>
                <span className="sm:hidden">{weekday} </span>
                {parseDateOnly(cell.key).getDate()}
                {isToday && <span className="sr-only"> (hoy)</span>}
              </span>
              <span className="line-clamp-2 font-semibold text-ink-soft">{info.title}</span>
              {info.sub && <span className="tabular text-ink-muted">{info.sub}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
