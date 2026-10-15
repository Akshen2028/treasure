import { RotateCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RepositoryError } from '@/data/repository'

import { EmptyState } from './EmptyState'

/** Consistent failure state with a retry button. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const description =
    error instanceof RepositoryError
      ? error.message
      : 'We couldn’t load the wedding details. Check your connection and try again.'
  return (
    <EmptyState
      icon={WifiOff}
      title="Couldn’t load"
      description={description}
      action={
        <Button variant="outline" onClick={onRetry}>
          <RotateCw data-icon="inline-start" />
          Try again
        </Button>
      }
      className="my-8"
    />
  )
}
