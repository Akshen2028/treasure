import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { env } from '@/lib/env'
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
  const { isPlanner } = useAccess()

  // When a planner locks the app, drop their cached snapshot (it includes deleted records).
  useEffect(() => {
    if (!isPlanner) {
      queryClient.removeQueries({ queryKey: weddingKeys.snapshot(env.weddingSlug, 'planner') })
    }
  }, [isPlanner, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryContext value={repository}>{children}</RepositoryContext>
    </QueryClientProvider>
  )
}
