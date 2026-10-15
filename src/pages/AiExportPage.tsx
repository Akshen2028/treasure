import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function AiExportPage() {
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="AI Export" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="AI Export"
          step="step 14"
          description="Export the full wedding as JSON or Markdown for ChatGPT or Claude."
        />
      </PageContainer>
    </>
  )
}
