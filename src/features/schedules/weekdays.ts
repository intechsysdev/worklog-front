/** Días L M X J V S D y su bandera en WeekDays (.NET, [Flags], serializado como texto). */
export const weekDays = [
  { letter: 'L', name: 'Monday', label: 'Lunes' },
  { letter: 'M', name: 'Tuesday', label: 'Martes' },
  { letter: 'X', name: 'Wednesday', label: 'Miércoles' },
  { letter: 'J', name: 'Thursday', label: 'Jueves' },
  { letter: 'V', name: 'Friday', label: 'Viernes' },
  { letter: 'S', name: 'Saturday', label: 'Sábado' },
  { letter: 'D', name: 'Sunday', label: 'Domingo' },
] as const

export type DayLetter = (typeof weekDays)[number]['letter']

/** "LMXJV" → ['L','M','X','J','V']. */
export const lettersToDays = (letters: string) =>
  weekDays.filter((day) => letters.includes(day.letter)).map((day) => day.letter)

/** ['L','S'] → "Monday, Saturday" (el convertidor de .NET acepta la lista separada por comas). */
export const daysToFlags = (days: DayLetter[]) =>
  weekDays
    .filter((day) => days.includes(day.letter))
    .map((day) => day.name)
    .join(', ') || 'None'

/** Minutos desde medianoche ↔ "hh:mm" / "hh:mm:ss". */
export const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export const toTimeOnly = (minutes: number) => `${minutesToTime(minutes)}:00`

/** "40 h", "7 h 30 m". */
export const hoursText = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} m` : `${h} h`
}
