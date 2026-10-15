import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { type WeddingData, useWeddingData } from '@/data/queries'
import { WeddingNotFoundError } from '@/data/repository'

import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

/**
 * Loads the wedding and renders the right state: loading skeleton, not-set-up, error with
 * retry, or the children with data. Every data-driven page uses this for consistency.
 */
export function WeddingDataBoundary({ children }: { children: (data: WeddingData) => ReactNode }) {
  const { data, error, isPending, refetch } = useWeddingData()

  if (isPending) return <LoadingState />
  if (error instanceof WeddingNotFoundError) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Wedding not set up yet"
        description="A planner needs to run the setup script before the wedding can be shown."
        className="my-8"
      />
    )
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />
  return children(data)
}
