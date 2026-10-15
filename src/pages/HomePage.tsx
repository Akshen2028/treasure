import { CalendarHeart } from 'lucide-react'

import { paths } from '@/app/paths'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { LiveCountdown } from '@/components/wedding/LiveCountdown'
import { formatDate } from '@/domain/dates'
import type { Wedding } from '@/domain/types'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

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

export function HomePage() {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <WeddingDataBoundary>
          {({ snapshot, active }) => (
            <>
              <WeddingHero wedding={snapshot.wedding} />
              <ScaffoldPlaceholder
                heading=""
                step="steps 06 and 11"
                description={`${active.events.length} event${active.events.length === 1 ? '' : 's'} and ${snapshot.categoryDefinitions.length} shared categories loaded. Event cards, the budget overview and charts come next.`}
                next={{ to: paths.event('preview'), label: 'Preview event screen' }}
              />
            </>
          )}
        </WeddingDataBoundary>
      </PageContainer>
    </>
  )
}
