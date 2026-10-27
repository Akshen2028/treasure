import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageContainer } from '@/components/layout/PageContainer'
import { type WeddingData, useWeddingData } from '@/data/queries'
import { WeddingNotFoundError } from '@/data/repository'

import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

/**
 * Loads the wedding and renders the right state: loading skeleton, not-set-up, error with
 * retry, or the children with data. Every data-driven page uses this for consistency.
 */
export function WeddingDataBoundary({
  children,
  fallbackHeader,
}: {
  children: (data: WeddingData) => ReactNode
  /**
   * For pages that render their own header and container: shown, with a page container,
   * around the loading and error states so the back button is always available.
   */
  fallbackHeader?: ReactNode
}) {
  const { data, error, isPending, refetch } = useWeddingData()
  const frame = (content: ReactNode) =>
    fallbackHeader ? (
      <>
        {fallbackHeader}
        <PageContainer>{content}</PageContainer>
      </>
    ) : (
      content
    )

  if (isPending) return frame(<LoadingState />)
  if (error instanceof WeddingNotFoundError) {
    return frame(
      <EmptyState
        icon={SearchX}
        title="Wedding not found"
        description="Check the link. A private wedding opens only from the link its planners share."
        className="my-8"
      />,
    )
  }
  if (error || !data) return frame(<ErrorState error={error} onRetry={() => void refetch()} />)
  return children(data)
}
