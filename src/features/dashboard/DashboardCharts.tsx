import { useState } from 'react'

import { SegmentedControl } from '@/components/forms/SegmentedControl'
import type { WeddingData } from '@/data/queries'

import { categoryAllocation, eventAllocation, type Measure } from './allocation'
import { AllocationChart } from './AllocationChart'
import { ChartCarousel } from './ChartCarousel'

const MEASURES = [
  { value: 'budget', label: 'Budget' },
  { value: 'paid', label: 'Paid' },
] as const

/** Where the money goes: by event and by shared category, for budget or paid. */
export function DashboardCharts({ data }: { data: WeddingData }) {
  const [measure, setMeasure] = useState<Measure>('budget')
  const empty = measure === 'budget' ? 'No budget set yet.' : 'Nothing paid yet.'

  return (
    <section className="mt-10" aria-labelledby="allocation-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="allocation-heading" className="text-3xl">
          Where it goes
        </h2>
        <SegmentedControl
          label="Show budget or paid"
          options={MEASURES}
          value={measure}
          onChange={setMeasure}
          className="w-48"
        />
      </div>
      <ChartCarousel labels={['By event', 'By category']}>
        <AllocationChart
          title="By event"
          measure={measure}
          allocation={eventAllocation(data.active, data.budget, measure)}
          emptyText={empty}
        />
        <AllocationChart
          title="By category"
          measure={measure}
          allocation={categoryAllocation(data.active, data.budget, measure)}
          emptyText={empty}
        />
      </ChartCarousel>
    </section>
  )
}
