import { createContext, use } from 'react'

import type { WeddingRepository } from './repository'

export const RepositoryContext = createContext<WeddingRepository | null>(null)

/** The active data backend. Swappable in tests via <RepositoryContext value={…}>. */
export function useRepository(): WeddingRepository {
  const repository = use(RepositoryContext)
  if (!repository) throw new Error('useRepository must be used inside <DataProvider>')
  return repository
}
