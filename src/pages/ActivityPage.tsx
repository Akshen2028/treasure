import { useParams } from 'react-router'

import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function ActivityPage() {
  const { eventId = '', categoryId = '', activityId = '' } = useParams()
  return (
    <>
      <DetailHeader
        backTo={paths.category(eventId, categoryId)}
        backLabel="Category"
        title="Activity"
      />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Activity"
          step="steps 08 and 10"
          description="Status, budget, notes, images, links and a summary of payments."
          next={{
            to: paths.payments(eventId, categoryId, activityId),
            label: 'Preview payments screen',
          }}
        />
      </PageContainer>
    </>
  )
}
