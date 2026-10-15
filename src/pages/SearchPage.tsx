import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function SearchPage() {
  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Dashboard" title="Search" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Search"
          step="step 12"
          description="Search events, categories, activities and notes across the wedding."
        />
      </PageContainer>
    </>
  )
}
