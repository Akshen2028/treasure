import { paths } from '@/app/paths'
import { PlannerOnly } from '@/components/auth/PlannerOnly'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function AiExportPage() {
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="AI Export" />
      <PageContainer>
        <PlannerOnly feature="AI Export">
          <ScaffoldPlaceholder
            heading="AI Export"
            step="step 14"
            description="Export the full wedding as JSON or Markdown for ChatGPT or Claude."
          />
        </PlannerOnly>
      </PageContainer>
    </>
  )
}
