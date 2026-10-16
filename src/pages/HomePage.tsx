import { CalendarHeart, PartyPopper, Plus } from 'lucide-react'
import { useState } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { LiveCountdown } from '@/components/wedding/LiveCountdown'
import type { WeddingData } from '@/data/queries'
import { formatDate } from '@/domain/dates'
import { sortEvents } from '@/domain/ordering'
import type { Wedding } from '@/domain/types'
import { EventCard } from '@/features/events/EventCard'
import { EventFormSheet } from '@/features/events/EventFormSheet'

function WeddingHero({ wedding }: { wedding: Wedding }) {
  return (
    <section className="pt-8 pb-2">
      <h1 className="text-4xl sm:text-5xl">{wedding.name}</h1>
      {wedding.weddingDate && (
        <>
          <p className="mt-3 inline-flex items-center gap-2 text-muted-foreground">
            <CalendarHeart className="size-4 text-gold" aria-hidden="true" />
            {formatDate(wedding.weddingDate, 'long')}
          </p>
          <div className="mt-6">
            <LiveCountdown date={wedding.weddingDate} />
          </div>
        </>
      )}
    </section>
  )
}

function EventsSection({ data }: { data: WeddingData }) {
  const { isPlanner } = useAccess()
  const [adding, setAdding] = useState(false)
  const events = sortEvents(data.active.events)

  return (
    <section className="mt-10" aria-labelledby="events-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="events-heading" className="text-3xl">
          Events
        </h2>
        {isPlanner && events.length > 0 && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No events yet"
          description={
            isPlanner
              ? 'Add the celebrations that make up your wedding, like a Mehndi, Ceremony or Reception.'
              : 'The planners haven’t added any events yet.'
          }
          action={
            isPlanner && (
              <Button onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                Add your first event
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const summary = data.budget.events.get(event.id)
            return (
              summary && (
                <li key={event.id}>
                  <EventCard event={event} summary={summary} />
                </li>
              )
            )
          })}
        </ul>
      )}

      {isPlanner && (
        <EventFormSheet open={adding} onOpenChange={setAdding} wedding={data.snapshot.wedding} />
      )}
    </section>
  )
}

export function HomePage() {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <WeddingDataBoundary>
          {(data) => (
            <>
              <WeddingHero wedding={data.snapshot.wedding} />
              <EventsSection data={data} />
            </>
          )}
        </WeddingDataBoundary>
      </PageContainer>
    </>
  )
}
