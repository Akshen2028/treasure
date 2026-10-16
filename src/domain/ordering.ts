import type { WeddingEvent } from './types'

/**
 * Events in the order a wedding unfolds: by date (undated last), then manual sort order,
 * then creation time so the order is always stable.
 */
export function sortEvents(events: WeddingEvent[]): WeddingEvent[] {
  return [...events].sort((a, b) => {
    if (a.eventDate !== b.eventDate) {
      if (a.eventDate === null) return 1
      if (b.eventDate === null) return -1
      return a.eventDate.localeCompare(b.eventDate)
    }
    return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
  })
}
