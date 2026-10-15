import { QueryClient } from '@tanstack/react-query'

import { RepositoryError, WeddingNotFoundError } from './repository'

/** Retrying cannot fix a missing wedding or a refused write, only transient failures. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof WeddingNotFoundError) return false
  if (error instanceof RepositoryError && error.reason !== 'network') return false
  return failureCount < 2
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 30 s; refocusing the app or reconnecting refetches,
        // which is how changes made on another device show up.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  })
}
