import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

export function SettingsPage() {
  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Dashboard" title="Settings" />
      <PageContainer>
        <ScaffoldPlaceholder
          heading="Settings"
          step="step 13"
          description="Planner access, Recently Deleted and AI Export."
          next={{ to: paths.recentlyDeleted, label: 'Preview Recently Deleted' }}
        />
        <ScaffoldPlaceholder
          heading="AI Export"
          step="step 14"
          description="Download the wedding as JSON or Markdown."
          next={{ to: paths.aiExport, label: 'Preview AI Export' }}
        />
      </PageContainer>
    </>
  )
}
