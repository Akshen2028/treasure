import { paths } from '@/app/paths'
import { PlannerOnly } from '@/components/auth/PlannerOnly'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function RecentlyDeletedPage() {
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="Recently Deleted" />
      <PageContainer>
        <PlannerOnly feature="Recently Deleted">
          <ScaffoldPlaceholder
            heading="Recently Deleted"
            step="step 13"
            description="Deleted events, categories, activities and payments, with restore."
          />
        </PlannerOnly>
      </PageContainer>
    </>
  )
}
