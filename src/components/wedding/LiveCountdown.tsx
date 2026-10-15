import { useEffect, useState } from 'react'

import { countdownParts, daysBetween, localStartOfDay, todayIso } from '@/domain/dates'
import type { IsoDate } from '@/domain/types'

/** Re-renders once per second, aligned to the start of each second. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => clearTimeout(timer)
  }, [])
  return now
}

const UNITS = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Minutes'],
  ['seconds', 'Seconds'],
] as const

/** Live countdown to the start of the wedding day in the viewer's time zone. */
export function LiveCountdown({ date }: { date: IsoDate }) {
  const now = useNow()
  const parts = countdownParts(localStartOfDay(date), now)

  if (parts.arrived) {
    const daysSince = daysBetween(date, todayIso(new Date(now)))
    const message =
      daysSince <= 0
        ? 'Today’s the day'
        : daysSince === 1
          ? 'Married yesterday'
          : `Married ${daysSince.toLocaleString('en-CA')} days ago`
    return <p className="font-heading text-2xl text-gold italic">{message}</p>
  }

  return (
    <div>
      {/* Screen readers get one stable sentence instead of a value changing every second. */}
      <p className="sr-only">{parts.days.toLocaleString('en-CA')} days until the wedding</p>
      <div aria-hidden="true" className="grid grid-cols-4 gap-2 sm:gap-3">
        {UNITS.map(([key, label]) => (
          <div
            key={key}
            className="flex flex-col items-center rounded-2xl border border-gold/20 bg-card px-1 py-3 shadow-soft"
          >
            <span className="font-heading text-3xl leading-none font-medium lining-nums tabular-nums sm:text-4xl">
              {key === 'days'
                ? parts[key].toLocaleString('en-CA')
                : String(parts[key]).padStart(2, '0')}
            </span>
            <span className="mt-1.5 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
