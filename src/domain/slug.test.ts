import { describe, expect, it } from 'vitest'

import { FALLBACK_SLUG, SLUG_BASE_MAX, SLUG_PATTERN, slugCandidate, slugify } from './slug'

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

  it('always satisfies the database rule, even with a suffix', () => {
    for (const name of ['Alex & Sam', 'x'.repeat(200), '💍', 'Zoë']) {
      expect(slugify(name)).toMatch(SLUG_PATTERN)
      expect(slugCandidate(slugify(name), 999)).toMatch(SLUG_PATTERN)
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
