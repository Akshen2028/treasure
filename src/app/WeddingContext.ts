import { createContext, use, useMemo } from 'react'

import { type WeddingPaths, weddingPaths } from './paths'

/** The wedding in the current URL, and the share key that opens it if it is private. */
export type WeddingRoute = { slug: string; shareKey: string | null }

export const WeddingContext = createContext<WeddingRoute | null>(null)

/** The current wedding, or null outside `/w/:slug/...` (e.g. on the welcome screen). */
export function useOptionalWeddingRoute(): WeddingRoute | null {
  return use(WeddingContext)
}

export function useWeddingRoute(): WeddingRoute {
  const value = use(WeddingContext)
  if (!value) throw new Error('useWeddingRoute must be used inside a /w/:slug route')
  return value
}

/** URLs of the current wedding's screens. */
export function useWeddingPaths(): WeddingPaths {
  const { slug } = useWeddingRoute()
  return useMemo(() => weddingPaths(slug), [slug])
}
