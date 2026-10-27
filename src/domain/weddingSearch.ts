import type { IsoDate } from './types'

/** A Public wedding found from the landing page (`search_weddings`). */
export type WeddingSearchResult = {
  name: string
  slug: string
  weddingDate: IsoDate | null
}

/** The server ignores shorter or longer terms (`search_weddings`), so the app doesn't send them. */
export const WEDDING_SEARCH_MIN_LENGTH = 3
export const WEDDING_SEARCH_MAX_LENGTH = 100

/**
 * The term to search Public weddings for, or null when there's nothing worth asking yet.
 * Trims and collapses spaces so "alex   sam " finds "Alex Sam".
 */
export function weddingSearchTerm(input: string): string | null {
  const term = input.trim().replace(/\s+/g, ' ')
  if (term.length < WEDDING_SEARCH_MIN_LENGTH || term.length > WEDDING_SEARCH_MAX_LENGTH) {
    return null
  }
  return term
}
