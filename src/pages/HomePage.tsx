import { paths } from '@/app/paths'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function HomePage() {
  return (
    <>
      <AppHeader />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Our Wedding"
          step="steps 06 and 11"
          description="The budget overview, spending charts and event cards will live here."
          next={{ to: paths.event('preview'), label: 'Preview event screen' }}
        />
      </PageContainer>
    </>
  )
}
