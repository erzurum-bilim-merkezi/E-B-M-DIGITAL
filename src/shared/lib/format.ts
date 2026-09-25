/** All dates are shown in Europe/Istanbul, whatever the device time zone (ADR 0012). */
export const APP_TIME_ZONE = 'Europe/Istanbul'

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})
const shortDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: APP_TIME_ZONE,
})
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
})
const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
})
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: APP_TIME_ZONE,
})
const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: APP_TIME_ZONE,
})
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: APP_TIME_ZONE,
})

const numberFormatter = new Intl.NumberFormat('tr-TR')
const percentFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  maximumFractionDigits: 0,
})

export const formatDate = (value: string | Date) => dateFormatter.format(new Date(value))
export const formatShortDate = (value: string | Date) => shortDateFormatter.format(new Date(value))
export const formatDateTime = (value: string | Date) => dateTimeFormatter.format(new Date(value))
export const formatTime = (value: string | Date) => timeFormatter.format(new Date(value))
export const formatNumber = (value: number) => numberFormatter.format(value)
export const formatPercent = (ratio: number) =>
  percentFormatter.format(Number.isFinite(ratio) ? ratio : 0)

/** `YYYY-MM-DD` of the instant in Istanbul — the analytics day bucket. */
export function istanbulDayKey(value: string | Date) {
  return dayKeyFormatter.format(new Date(value))
}

/** 0–23 hour in Istanbul. */
export function istanbulHour(value: string | Date) {
  return Number(hourFormatter.format(new Date(value))) % 24
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** 0 = Monday … 6 = Sunday, in Istanbul. */
export function istanbulWeekday(value: string | Date) {
  return Math.max(0, WEEKDAYS.indexOf(weekdayFormatter.format(new Date(value))))
}

/** Consecutive day keys ending today (inclusive), oldest first. */
export function lastDayKeys(days: number, now = new Date()) {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(istanbulDayKey(new Date(now.getTime() - i * 86_400_000)))
  }
  return [...new Set(keys)]
}

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto', style: 'short' })

/** "2 dk. önce", "dün", "3 gün önce" … */
export function formatRelative(value: string | Date, now = new Date()) {
  const diffSeconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 45) return 'az önce'
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 86_400 * 30) return relative.format(Math.round(diffSeconds / 86_400), 'day')
  return formatDate(value)
}

/** 45 000 → "45 sn", 150 000 → "2 dk 30 sn". */
export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours} sa ${minutes} dk`
  if (minutes > 0) return seconds > 0 ? `${minutes} dk ${seconds} sn` : `${minutes} dk`
  return `${seconds} sn`
}

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB']
export function formatBytes(bytes: number) {
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: digits })} ${BYTE_UNITS[unit] ?? 'B'}`
}
