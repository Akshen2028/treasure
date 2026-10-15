import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function RecentlyDeletedPage() {
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="Recently Deleted" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Recently Deleted"
          step="step 13"
          description="Deleted events, categories, activities and payments, with restore."
        />
      </PageContainer>
    </>
  )
}
