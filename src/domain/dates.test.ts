import { describe, expect, it } from 'vitest'

import {
  countdownLabel,
  countdownParts,
  daysBetween,
  formatDate,
  localStartOfDay,
  todayIso,
} from './dates'

describe('dates', () => {
  it('formats without shifting the day', () => {
    expect(formatDate('2028-07-01')).toBe('Jul 1, 2028')
    expect(formatDate('2028-07-01', 'long')).toBe('Saturday, July 1, 2028')
  })

  it('counts whole days, including across daylight saving changes', () => {
    expect(daysBetween('2026-10-15', '2026-10-16')).toBe(1)
    expect(daysBetween('2027-03-13', '2027-03-15')).toBe(2)
    expect(daysBetween('2026-10-15', '2026-10-10')).toBe(-5)
  })

  it('labels a countdown', () => {
    expect(countdownLabel('2026-10-15', '2026-10-15')).toBe('Today')
    expect(countdownLabel('2026-10-16', '2026-10-15')).toBe('Tomorrow')
    expect(countdownLabel('2026-10-14', '2026-10-15')).toBe('Yesterday')
    expect(countdownLabel('2028-07-01', '2026-10-15')).toBe('625 days to go')
    expect(countdownLabel('2026-10-10', '2026-10-15')).toBe('5 days ago')
  })

  it('reads today in local time', () => {
    expect(todayIso(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
  })
})

describe('live countdown', () => {
  it('targets local midnight at the start of the date', () => {
    const start = new Date(localStartOfDay('2028-07-01'))
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([
      2028, 6, 1, 0,
    ])
  })

  it('splits the remaining time into parts', () => {
    const target = Date.UTC(2028, 6, 1)
    const now = target - ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 - 250
    expect(countdownParts(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      arrived: false,
    })
  })

  it('stops at zero once the moment arrives', () => {
    const target = Date.UTC(2028, 6, 1)
    expect(countdownParts(target, target)).toMatchObject({ days: 0, seconds: 0, arrived: true })
    expect(countdownParts(target, target + 60_000).arrived).toBe(true)
  })
})
