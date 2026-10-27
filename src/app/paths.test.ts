import { describe, expect, it } from 'vitest'

import { entryPath, legacyRedirect, paths, safeNext, screenPath, weddingPaths } from './paths'

describe('paths', () => {
  const p = weddingPaths('alex-sam')

  it('puts every screen of a wedding under its slug', () => {
    expect(paths.wedding('alex-sam')).toBe('/w/alex-sam/home')
    expect(p.settings).toBe('/w/alex-sam/settings')
    expect(p.recentlyDeleted).toBe('/w/alex-sam/settings/deleted')
    expect(p.chat).toBe('/w/alex-sam/chat')
  })

  it('builds nested detail URLs down to payments', () => {
    expect(p.event('e1')).toBe('/w/alex-sam/events/e1')
    expect(p.category('e1', 'c1')).toBe('/w/alex-sam/events/e1/categories/c1')
    expect(p.activity('e1', 'c1', 'a1')).toBe('/w/alex-sam/events/e1/categories/c1/activities/a1')
    expect(p.payments('e1', 'c1', 'a1')).toBe(
      '/w/alex-sam/events/e1/categories/c1/activities/a1/payments',
    )
  })

  it('escapes a slug that would break the URL', () => {
    expect(weddingPaths('a/b?c').home).toBe('/w/a%2Fb%3Fc/home')
  })
})

describe('screenPath', () => {
  it('drops the wedding prefix', () => {
    expect(screenPath('/w/alex-sam/events/e1')).toBe('/events/e1')
    expect(screenPath('/w/alex-sam')).toBe('/')
    expect(screenPath('/home')).toBe('/home')
    expect(screenPath('/wedding/home')).toBe('/wedding/home')
  })
})

describe('legacyRedirect', () => {
  it('sends old URLs to the same screen of the original wedding', () => {
    expect(legacyRedirect('/home')).toBe('/w/main/home')
    expect(legacyRedirect('/settings/deleted')).toBe('/w/main/settings/deleted')
    expect(legacyRedirect('/events/e1/categories/c1', '?x=1', '#top')).toBe(
      '/w/main/events/e1/categories/c1?x=1#top',
    )
  })

  it('leaves other URLs alone', () => {
    expect(legacyRedirect('/')).toBeNull()
    expect(legacyRedirect('/homes')).toBeNull()
    expect(legacyRedirect('/w/main/home')).toBeNull()
  })
})

describe('safeNext', () => {
  it('accepts wedding URLs with a query', () => {
    expect(safeNext('/w/alex-sam/home')).toBe('/w/alex-sam/home')
    expect(safeNext('/w/alex-sam/home?k=abc')).toBe('/w/alex-sam/home?k=abc')
    expect(safeNext('/w/alex-sam')).toBe('/w/alex-sam')
  })

  it('rejects anything that could leave the wedding pages', () => {
    for (const next of [
      null,
      '',
      '/',
      '/home',
      'https://evil.test',
      '//evil.test',
      '/w//evil.test',
      '/w/a\\b',
      '/w/a/x//y',
      '/w/a/ b',
    ])
      expect(safeNext(next)).toBeNull()
  })
})

describe('entryPath', () => {
  it('returns to the wedding the visitor came for', () => {
    expect(entryPath('/w/alex-sam/home?k=abc', 'main')).toBe('/w/alex-sam/home?k=abc')
  })

  it('otherwise opens the planner’s own wedding, or the original one for guests', () => {
    expect(entryPath(null, 'alex-sam')).toBe('/w/alex-sam/home')
    expect(entryPath('https://evil.test', null)).toBe('/w/main/home')
  })
})
