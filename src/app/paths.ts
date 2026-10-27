/**
 * Single source of truth for URLs. Pages and links build URLs through these
 * helpers so route shapes can change in one place.
 */
export const paths = {
  welcome: '/',
  /** First run for a signed-in account that plans no wedding yet. */
  createWedding: '/create',
  terms: '/terms',
  privacy: '/privacy',
  /** The dashboard of a wedding. */
  wedding: (slug: string) => weddingPaths(slug).home,
} as const

/** The wedding that owned the app before per-wedding URLs; old URLs redirect to it. */
export const LEGACY_SLUG = 'main'

/** The part of every wedding URL before the screen, e.g. `/w/alex-sam`. */
export const weddingBase = (slug: string) => `/w/${encodeURIComponent(slug)}`

/** URLs of the screens inside one wedding. Components get these from `useWeddingPaths()`. */
export function weddingPaths(slug: string) {
  const base = weddingBase(slug)
  return {
    home: `${base}/home`,
    search: `${base}/search`,
    settings: `${base}/settings`,
    recentlyDeleted: `${base}/settings/deleted`,
    aiExport: `${base}/settings/export`,
    chat: `${base}/chat`,
    event: (eventId: string) => `${base}/events/${eventId}`,
    category: (eventId: string, categoryId: string) =>
      `${base}/events/${eventId}/categories/${categoryId}`,
    activity: (eventId: string, categoryId: string, activityId: string) =>
      `${base}/events/${eventId}/categories/${categoryId}/activities/${activityId}`,
    payments: (eventId: string, categoryId: string, activityId: string) =>
      `${base}/events/${eventId}/categories/${categoryId}/activities/${activityId}/payments`,
  } as const
}

export type WeddingPaths = ReturnType<typeof weddingPaths>

/**
 * The link a planner shares. A Private wedding's link carries its share key (`?k=`); a Public
 * one's doesn't, so it stops working if the wedding is made Private (decided 2026-10-27).
 */
export function shareLink(origin: string, slug: string, shareKey: string | null): string {
  const url = `${origin}${weddingPaths(slug).home}`
  return shareKey ? `${url}?k=${encodeURIComponent(shareKey)}` : url
}

/** A pathname without its `/w/{slug}` prefix (`/w/main/events/e1` → `/events/e1`). */
export function screenPath(pathname: string): string {
  return pathname.replace(/^\/w\/[^/]+(?=\/|$)/, '') || '/'
}

/**
 * Maps a URL from before per-wedding routes (`/home`, `/events/…`) to the same screen of the
 * legacy wedding, keeping the query and hash. Returns null for anything else.
 */
export function legacyRedirect(pathname: string, search = '', hash = ''): string | null {
  if (!/^\/(home|search|settings|chat|events)(\/|$)/.test(pathname)) return null
  return `${weddingBase(LEGACY_SLUG)}${pathname}${search}${hash}`
}

/**
 * A `?next=` target from the welcome screen, if it is a wedding URL on this site. Anything
 * else (another site, `//host`, odd characters) is ignored so the parameter can't redirect away.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !/^\/w\/[^/?#\\]+(?:[/?#][^\\\s]*)?$/.test(next) || next.includes('//')) return null
  return next
}
