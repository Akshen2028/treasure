import { useQuery } from '@tanstack/react-query'

import { useRepository } from '@/data/RepositoryContext'
import type { Id } from '@/domain/types'

export const aiUsageKey = (weddingId: Id) => ['ai-usage', weddingId] as const

/**
 * Questions asked today and the daily limit (planners only). Display only: the chat function
 * counts and enforces the limit. Refreshed after every question.
 */
export function useAiUsage(weddingId: Id | undefined) {
  const repository = useRepository()
  return useQuery({
    queryKey: aiUsageKey(weddingId ?? ''),
    queryFn: () => repository.getAiUsage(weddingId!),
    enabled: Boolean(weddingId),
  })
}
