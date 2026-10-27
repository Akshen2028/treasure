import { paths } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { legalTitles, type LegalDocument } from './legal'
import { PrivacyContent, TermsContent } from './legalDocuments'

/** A standalone Terms or Privacy page (also linked from Google's consent screen). */
export function LegalPage({ document }: { document: LegalDocument }) {
  const title = legalTitles[document]
  return (
    <>
      <DetailHeader backTo={paths.welcome} backLabel="Wedonomics" title={title} />
      <PageContainer className="max-w-2xl pt-6">
        <h1 className="mb-4 font-heading text-3xl font-medium">{title}</h1>
        {document === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </PageContainer>
    </>
  )
}
