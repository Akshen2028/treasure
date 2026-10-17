/**
 * Calendar-date helpers. Dates are `YYYY-MM-DD` strings with no time zone; they are
 * interpreted as UTC midnight so a date never shifts by a day in western time zones.
 */
import type { IsoDate } from './types'

function toUtcMs(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

const formatters = {
  long: new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  medium: new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }),
}

/** e.g. "Saturday, July 1, 2028" (long) or "Jul 1, 2028" (medium). */
export function formatDate(date: IsoDate, style: keyof typeof formatters = 'medium'): string {
  return formatters[style].format(toUtcMs(date))
}

/** Today's date in the viewer's local time zone, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): IsoDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000)
}

/** e.g. "631 days to go", "Tomorrow", "Today", "3 days ago". */
export function countdownLabel(date: IsoDate, today: IsoDate): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1) return `${days.toLocaleString('en-CA')} days to go`
  return `${Math.abs(days).toLocaleString('en-CA')} days ago`
}

/** Epoch ms of local midnight at the start of a calendar date, in the viewer's time zone. */
export function localStartOfDay(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!).getTime()
}

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** True once the target moment has been reached. */
  arrived: boolean
}

/** Splits the time remaining until `targetMs` into days, hours, minutes and seconds. */
export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const remaining = Math.max(0, Math.floor((targetMs - nowMs) / 1000))
  return {
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3_600),
    minutes: Math.floor((remaining % 3_600) / 60),
    seconds: remaining % 60,
    arrived: remaining === 0,
  }
}

/**
 * Short, friendly "when" for a past timestamp: "Just now", "5 min ago", "3 hours ago",
 * "Yesterday", "4 days ago", then a date like "Sep 28, 2026".
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = daysBetween(todayIso(then), todayIso(now))
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(todayIso(then))
}
