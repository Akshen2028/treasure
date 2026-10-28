import type { ErrorEvent } from '@sentry/react'
import { describe, expect, it } from 'vitest'

import { scrubBreadcrumb, scrubEvent, stripUrl } from './scrub'

describe('stripUrl', () => {
  it('removes share keys, tokens and filters', () => {
    expect(stripUrl('https://www.mywedonomics.com/w/main?k=secret')).toBe(
      'https://www.mywedonomics.com/w/main',
    )
    expect(stripUrl('/w/main#access_token=abc')).toBe('/w/main')
    expect(stripUrl('https://x.supabase.co/rest/v1/events?wedding_id=eq.1')).toBe(
      'https://x.supabase.co/rest/v1/events',
    )
  })

  it('leaves plain URLs alone', () => {
    expect(stripUrl('/w/main/settings')).toBe('/w/main/settings')
  })
})

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'Anjana’s dress $4,000' })).toBeNull()
  })

  it('strips navigation and fetch URLs', () => {
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/w/a?k=1', to: '/w/b#t=2' } }),
    ).toEqual({ category: 'navigation', data: { from: '/w/a', to: '/w/b' } })
    expect(
      scrubBreadcrumb({ category: 'fetch', data: { url: '/rest?x=1', status_code: 500 } }),
    ).toEqual({ category: 'fetch', data: { url: '/rest', status_code: 500 } })
  })
})

describe('scrubEvent', () => {
  it('keeps only the stripped request URL and scrubs breadcrumbs', () => {
    const event = {
      type: undefined,
      request: { url: '/w/main?k=secret', headers: { Referer: '/w/main?k=secret' } },
      breadcrumbs: [
        { category: 'console', message: 'hi' },
        { category: 'navigation', data: { to: '/w/main?k=secret' } },
      ],
    } satisfies ErrorEvent
    expect(scrubEvent(event)).toEqual({
      type: undefined,
      request: { url: '/w/main' },
      breadcrumbs: [{ category: 'navigation', data: { to: '/w/main' } }],
    })
  })
})
