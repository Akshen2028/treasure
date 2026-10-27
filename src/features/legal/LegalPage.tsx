import { useLocation } from 'react-router'

import { paths, safeNext } from '@/app/paths'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'

import { legalTitles, type LegalDocument } from './legal'
import { PrivacyContent, TermsContent } from './legalDocuments'

/** Router state from a link inside a wedding (Settings), so Back returns there. */
export type LegalPageState = { from: string }

/** A standalone Terms or Privacy page (also linked from Google's consent screen). */
export function LegalPage({ document }: { document: LegalDocument }) {
  const title = legalTitles[document]
  const state: unknown = useLocation().state
  const from =
    state && typeof state === 'object' && 'from' in state && typeof state.from === 'string'
      ? safeNext(state.from)
      : null
  return (
    <>
      <DetailHeader
        backTo={from ?? paths.welcome}
        backLabel={from ? 'Settings' : 'Wedonomics'}
        title={title}
      />
      <PageContainer className="max-w-2xl pt-6">
        <h1 className="mb-4 font-heading text-3xl font-medium">{title}</h1>
        {document === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </PageContainer>
    </>
  )
}
