import { useParams } from 'react-router'

import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function EventPage() {
  const { eventId = '' } = useParams()
  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Dashboard" title="Event" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Event"
          step="step 06"
          description="Event details, budget, progress and its categories."
          next={{ to: paths.category(eventId, 'preview'), label: 'Preview category screen' }}
        />
      </PageContainer>
    </>
  )
}
