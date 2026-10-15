import { useParams } from 'react-router'

import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function CategoryPage() {
  const { eventId = '', categoryId = '' } = useParams()
  return (
    <>
      <DetailHeader backTo={paths.event(eventId)} backLabel="Event" title="Category" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Category"
          step="step 07"
          description="Category budget, progress and its activities."
          next={{
            to: paths.activity(eventId, categoryId, 'preview'),
            label: 'Preview activity screen',
          }}
        />
      </PageContainer>
    </>
  )
}
