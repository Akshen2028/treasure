import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { type BudgetIndex, computeBudgetIndex } from '@/domain/budget'
import { type ActiveSnapshot, selectActive } from '@/domain/hierarchy'
import type { WeddingSnapshot } from '@/domain/types'
import { env } from '@/lib/env'

import { useRepository } from './RepositoryContext'
import type { WeddingRepository } from './repository'

export type Audience = 'planner' | 'guest'

/**
 * Planners and guests receive different snapshots (planners also get soft-deleted records),
 * so each audience has its own cache entry.
 */
export const weddingKeys = {
  all: ['wedding'] as const,
  snapshot: (slug: string, audience: Audience) => ['wedding', slug, audience] as const,
}

export function useSnapshotKey() {
  const { isPlanner } = useAccess()
  return weddingKeys.snapshot(env.weddingSlug, isPlanner ? 'planner' : 'guest')
}

export function useWeddingSnapshot() {
  const repository = useRepository()
  const queryKey = useSnapshotKey()
  return useQuery({
    queryKey,
    queryFn: () => repository.loadSnapshot(env.weddingSlug),
  })
}

export type WeddingData = {
  /** Everything loaded, including soft-deleted records for planners. */
  snapshot: WeddingSnapshot
  /** Only records that are active and have active ancestors. */
  active: ActiveSnapshot
  /** Budget, paid and progress for every level. */
  budget: BudgetIndex
}

/** The wedding plus everything derived from it, recomputed only when the data changes. */
export function useWeddingData() {
  const query = useWeddingSnapshot()
  const data = useMemo<WeddingData | undefined>(
    () =>
      query.data && {
        snapshot: query.data,
        active: selectActive(query.data),
        budget: computeBudgetIndex(query.data),
      },
    [query.data],
  )
  return { ...query, data }
}

type SnapshotMutationOptions<TVariables, TResult> = {
  mutationFn: (repository: WeddingRepository, variables: TVariables) => Promise<TResult>
  /**
   * Applies the change to the cached snapshot immediately. Use only for safe, reversible
   * edits; it is rolled back automatically if the server refuses the write.
   */
  optimistic?: (snapshot: WeddingSnapshot, variables: TVariables) => WeddingSnapshot
  /** Folds the server's result into the cache before the background refetch. */
  reconcile?: (snapshot: WeddingSnapshot, result: TResult, variables: TVariables) => WeddingSnapshot
}

/**
 * Standard write path: run the repository call, optionally update the cache optimistically,
 * roll back on failure, then refetch so every derived total comes from the server.
 */
export function useSnapshotMutation<TVariables, TResult>({
  mutationFn,
  optimistic,
  reconcile,
}: SnapshotMutationOptions<TVariables, TResult>) {
  const repository = useRepository()
  const queryClient = useQueryClient()
  const queryKey = useSnapshotKey()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(repository, variables),
    onMutate: async (variables) => {
      if (!optimistic) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<WeddingSnapshot>(queryKey)
      if (previous) queryClient.setQueryData(queryKey, optimistic(previous, variables))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSuccess: (result, variables) => {
      if (!reconcile) return
      queryClient.setQueryData<WeddingSnapshot>(queryKey, (current) =>
        current ? reconcile(current, result, variables) : current,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weddingKeys.all }),
  })
}
