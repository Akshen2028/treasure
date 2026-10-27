import { describe, expect, it } from 'vitest'

import { weddingSearchTerm } from './weddingSearch'

describe('weddingSearchTerm', () => {
  it('needs at least 3 characters after trimming', () => {
    expect(weddingSearchTerm('')).toBeNull()
    expect(weddingSearchTerm('  al  ')).toBeNull()
    expect(weddingSearchTerm('ale')).toBe('ale')
  })

  it('trims and collapses spaces', () => {
    expect(weddingSearchTerm('  alex   sam ')).toBe('alex sam')
  })

  it('ignores terms the server would reject as too long', () => {
    expect(weddingSearchTerm('a'.repeat(100))).toBe('a'.repeat(100))
    expect(weddingSearchTerm('a'.repeat(101))).toBeNull()
  })
})
