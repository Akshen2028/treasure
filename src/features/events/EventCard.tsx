import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { BudgetFigures } from '@/components/budget/BudgetFigures'
import type { LevelSummary } from '@/domain/budget'
import { formatDate } from '@/domain/dates'
import type { WeddingEvent } from '@/domain/types'
import { SafeImage } from '@/features/media/SafeImage'
import { useMediaUrl } from '@/data/queries'

/** Dashboard card: name, date, budget, paid and progress. */
export function EventCard({ event, summary }: { event: WeddingEvent; summary: LevelSummary }) {
  const mediaUrl = useMediaUrl()
  return (
    <Link
      viewTransition
      to={paths.event(event.id)}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lifted focus-visible:-translate-y-0.5"
    >
      {event.coverImagePath && (
        <SafeImage
          src={mediaUrl(event.coverImagePath)}
          alt=""
          loading="lazy"
          className="aspect-[16/7] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-2xl">{event.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-gold" aria-hidden="true" />
                {event.eventDate ? formatDate(event.eventDate) : 'Date to be decided'}
              </span>
              {event.location && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
                  <span className="truncate">{event.location}</span>
                </span>
              )}
            </p>
          </div>
          <ChevronRight
            className="mt-1.5 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
        <BudgetFigures summary={summary} />
      </div>
    </Link>
  )
}
