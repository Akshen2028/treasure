import { describe, expect, it } from 'vitest'

import {
  BLOCKED_SLUG_WORDS,
  FALLBACK_SLUG,
  isSlugBlocked,
  RESERVED_SLUGS,
  SLUG_BASE_MAX,
  SLUG_MAX,
  SLUG_MIN,
  SLUG_PATTERN,
  slugCandidate,
  slugError,
  slugify,
} from './slug'
// Vite loads the file as text, so the test sees exactly what gets pushed to the database.
import limitsMigration from '../../supabase/migrations/20261027150000_wedding_limits.sql?raw'

describe('slugify', () => {
  it.each([
    ['Alex & Sam', 'alex-sam'],
    ['  Akshen  and  Anjana  ', 'akshen-and-anjana'],
    ['Zoë & José', 'zoe-jose'],
    ['ÅSA + Ñico', 'asa-nico'],
    ['Priya_Raj 2027!', 'priya-raj-2027'],
    ['--Kim--Lee--', 'kim-lee'],
  ])('turns %j into %j', (name, slug) => {
    expect(slugify(name)).toBe(slug)
  })

  it.each(['', '   ', '&&&', '李 & 王', '💍'])('falls back for %j', (name) => {
    expect(slugify(name)).toBe(FALLBACK_SLUG)
  })

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(SLUG_BASE_MAX - 1)} bcd`)
    expect(slug).toBe('a'.repeat(SLUG_BASE_MAX - 1))
    expect(slugify('x'.repeat(200))).toHaveLength(SLUG_BASE_MAX)
  })

  it.each([
    ['Al', 'al-wedding'],
    ['Jo & Li', 'jo-li'],
    ['Admin', 'admin-wedding'],
    ['W', 'w-wedding'],
    ['Shit Happens', FALLBACK_SLUG],
    ['Scunthorpe Wedding', 'scunthorpe-wedding'],
  ])('steers %j away from short and blocked addresses: %j', (name, slug) => {
    expect(slugify(name)).toBe(slug)
  })

  it('always satisfies the database rules, even with a suffix', () => {
    for (const name of ['Alex & Sam', 'x'.repeat(200), '💍', 'Zoë', 'A', 'Terms', 'kkk']) {
      for (const slug of [slugify(name), slugCandidate(slugify(name), 999)]) {
        expect(slugError(slug)).toBeNull()
      }
    }
  })
})

describe('slugCandidate', () => {
  it('starts with the base and then numbers from 2', () => {
    expect([1, 2, 3].map((n) => slugCandidate('alex-sam', n))).toEqual([
      'alex-sam',
      'alex-sam-2',
      'alex-sam-3',
    ])
  })
})

describe('slugError', () => {
  it.each(['alex-sam', 'abc', '2027-priya', 'x'.repeat(SLUG_MAX), 'main', 'terms-and-co'])(
    'accepts %j',
    (slug) => {
      expect(slugError(slug)).toBeNull()
    },
  )

  it.each([
    ['', 'Enter a web address.'],
    ['ab', `Use at least ${SLUG_MIN} characters.`],
    ['alex-', expect.stringContaining('single hyphens')],
    ['alex--sam', expect.stringContaining('single hyphens')],
    ['admin', 'That address isn’t available. Try another.'],
    ['alex-fuck-sam', 'That address isn’t available. Try another.'],
    ['x'.repeat(SLUG_MAX + 1), 'Keep it to 63 characters or fewer.'],
    ['-alex', expect.stringContaining('lower-case')],
    ['alex sam', expect.stringContaining('lower-case')],
    ['Alex', expect.stringContaining('lower-case')],
    ['zoë', expect.stringContaining('lower-case')],
  ])('refuses %j', (slug, message) => {
    expect(slugError(slug)).toEqual(message)
  })
})

describe('isSlugBlocked', () => {
  it('blocks reserved addresses whole and offensive words anywhere', () => {
    expect(isSlugBlocked('settings')).toBe(true)
    expect(isSlugBlocked('settings-and-co')).toBe(false)
    expect(isSlugBlocked('nazi-party')).toBe(true)
    expect(isSlugBlocked('scunthorpe')).toBe(false)
  })
})

describe('blocklists match the database', () => {
  const sql = limitsMigration
  function sqlList(name: string): string[] {
    const block = sql.match(new RegExp(`-- ${name}:start([\\s\\S]*?)-- ${name}:end`))?.[1]
    return [...(block ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  }

  it('has the same reserved addresses', () => {
    expect(sqlList('reserved')).toEqual(RESERVED_SLUGS)
  })

  it('has the same offensive words', () => {
    expect(sqlList('offensive')).toEqual(BLOCKED_SLUG_WORDS)
  })

  it('keeps every list entry a valid slug shape', () => {
    for (const slug of [...RESERVED_SLUGS, ...BLOCKED_SLUG_WORDS]) {
      expect(slug).toMatch(SLUG_PATTERN)
    }
  })
})
