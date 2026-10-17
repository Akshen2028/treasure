import { useRepository } from '@/data/RepositoryContext'

/** Resolves stored media paths to URLs (a pure string operation, no network request). */
export function useMediaUrl(): (path: string) => string {
  return useRepository().mediaUrl
}
