import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LOCALE = 'es-CO'

/** Convierte "aaaa-mm-dd" a Date local sin desfase de zona horaria. */
export function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, day ?? 1)
}

/** Fecha local a "aaaa-mm-dd". */
export function toDateOnly(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayDateOnly = () => toDateOnly(new Date())

/** "3 nov 2026". */
export function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value)
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(date)
    .replace('.', '')
}

/** "3 de noviembre". */
export function formatDayMonth(value: string) {
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value)
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' }).format(date)
}

/** "Martes 3 de noviembre". */
export function formatLongDate(value: string) {
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value)
  const text = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  return capitalize(text.replace(',', ''))
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

/** "10:42" desde un ISO o un TimeOnly "10:42:00". */
export function formatClock(value?: string | null) {
  if (!value) return '—'
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

/** "38 h 40 m", "45 m", "8 h". */
export function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? '−' : ''
  const total = Math.abs(Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${sign}${m} m`
  if (m === 0) return `${sign}${h} h`
  return `${sign}${h} h ${m} m`
}

/** "hace 38 min", "hace 2 h", "ayer". */
export function formatRelative(value?: string | null) {
  if (!value) return '—'
  const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000)
  if (diffMinutes < 1) return 'hace un momento'
  if (diffMinutes < 60) return `hace ${diffMinutes} min`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  return formatDate(value)
}

/** "1 usuario", "3 usuarios". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(LOCALE).format(value)
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Comparación sin acentos ni mayúsculas, para buscadores locales. */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function initials(name?: string | null) {
  if (!name) return '··'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Descarga un texto como archivo (plantillas CSV). */
export function downloadText(fileName: string, content: string, type = 'text/csv;charset=utf-8') {
  // BOM: Excel abre bien los acentos de un CSV en UTF-8 solo si lo lleva.
  const blob = new Blob(['﻿', content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
