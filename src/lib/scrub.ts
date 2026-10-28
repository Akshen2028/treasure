import type { Breadcrumb, ErrorEvent } from '@sentry/react'

/**
 * Removes the query string and fragment from a URL. They can carry a Private wedding's share
 * key (`?k=`), sign-in codes and tokens (`#access_token=`), and Supabase filters.
 */
export function stripUrl(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? ''
}

/** Strips URLs and headers from an error report before it is sent. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = event.request.url ? { url: stripUrl(event.request.url) } : {}
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.flatMap((crumb) => scrubBreadcrumb(crumb) ?? [])
  }
  return event
}

/**
 * Drops console breadcrumbs (they can echo wedding data) and strips URLs from navigation and
 * network breadcrumbs.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === 'console') return null
  if (!crumb.data) return crumb
  const data = { ...crumb.data }
  for (const key of ['url', 'from', 'to']) {
    if (typeof data[key] === 'string') data[key] = stripUrl(data[key])
  }
  return { ...crumb, data }
}
