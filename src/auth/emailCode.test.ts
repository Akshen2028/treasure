import { describe, expect, it } from 'vitest'

import { isCompleteCode, isPlausibleEmail, normalizeCode, normalizeEmail } from './emailCode'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Anjana@Example.COM ')).toBe('anjana@example.com')
  })
})

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isPlausibleEmail('anjana@example.com')).toBe(true)
    expect(isPlausibleEmail('a.b+wedding@mail.example.co.uk')).toBe(true)
  })

  it('rejects obvious typos', () => {
    for (const email of ['', 'anjana', 'anjana@', '@example.com', 'anjana@example', 'a b@c.d']) {
      expect(isPlausibleEmail(email)).toBe(false)
    }
  })

  it('rejects addresses longer than email allows', () => {
    expect(isPlausibleEmail(`${'a'.repeat(250)}@b.co`)).toBe(false)
  })
})

describe('normalizeCode', () => {
  it('keeps only digits', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456')
    expect(normalizeCode('123-456')).toBe('123456')
  })
})

describe('isCompleteCode', () => {
  it('accepts 6 to 10 digits', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('1234567890')).toBe(true)
  })

  it('rejects short, long or non-digit codes', () => {
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('12345678901')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})
