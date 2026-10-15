import { useParams } from 'react-router'

import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function PaymentsPage() {
  const { eventId = '', categoryId = '', activityId = '' } = useParams()
  return (
    <>
      <DetailHeader
        backTo={paths.activity(eventId, categoryId, activityId)}
        backLabel="Activity"
        title="Payments"
      />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Payments"
          step="step 09"
          description="Installment history, outstanding balance and payment warnings."
        />
      </PageContainer>
    </>
  )
}
