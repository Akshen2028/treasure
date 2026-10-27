import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { supabase } from '@/lib/supabase'

import { createQueryClient } from './queryClient'
import { weddingKeys } from './queries'
import { RepositoryContext } from './RepositoryContext'
import type { WeddingRepository } from './repository'
import { createSupabaseRepository } from './supabase/SupabaseRepository'

const defaultRepository = createSupabaseRepository(supabase)

/** Provides the data backend and query cache to the app. */
export function DataProvider({
  children,
  repository = defaultRepository,
}: {
  children: ReactNode
  repository?: WeddingRepository
}) {
  const [queryClient] = useState(createQueryClient)
  const { plannerSlug } = useAccess()

  // When a planner locks the app, drop their cached snapshots (they include deleted records).
  useEffect(() => {
    if (!plannerSlug) {
      queryClient.removeQueries({ predicate: (query) => weddingKeys.isPlanner(query.queryKey) })
    }
  }, [plannerSlug, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryContext value={repository}>{children}</RepositoryContext>
    </QueryClientProvider>
  )
}
