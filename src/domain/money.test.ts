import { describe, expect, it } from 'vitest'

import {
  centsToInput,
  formatCad,
  formatPercent,
  isValidCents,
  MAX_CENTS,
  parseCadInput,
  sumCents,
} from './money'

describe('parseCadInput', () => {
  it.each([
    ['1234', 123_400],
    ['1234.5', 123_450],
    ['1234.56', 123_456],
    ['$1,234.56', 123_456],
    ['  $ 12,500 ', 1_250_000],
    ['.5', 50],
    ['0', 0],
    ['0.01', 1],
    ['12.', 1_200],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseCadInput(input)).toBe(cents)
  })

  it('avoids floating-point drift', () => {
    // 0.1 + 0.2 style errors would turn 19.99 into 1998.9999…
    expect(parseCadInput('19.99')).toBe(1_999)
    expect(parseCadInput('1.10')).toBe(110)
  })

  it.each(['', ' ', '.', 'abc', '-5', '1.234', '1.2.3', '12a', '$-1'])('rejects %j', (input) => {
    expect(parseCadInput(input)).toBeNull()
  })

  it('rejects amounts above the maximum', () => {
    expect(parseCadInput('999999999.99')).toBe(MAX_CENTS)
    expect(parseCadInput('1000000000')).toBeNull()
  })
})

describe('centsToInput', () => {
  it('round-trips with parseCadInput', () => {
    for (const cents of [0, 1, 50, 1_999, 123_456, 1_250_000]) {
      expect(parseCadInput(centsToInput(cents))).toBe(cents)
    }
  })

  it('omits cents for whole dollars', () => {
    expect(centsToInput(1_250_000)).toBe('12500')
    expect(centsToInput(1_250_050)).toBe('12500.50')
    expect(centsToInput(5)).toBe('0.05')
  })
})

describe('formatCad', () => {
  it('shows cents only when present by default', () => {
    expect(formatCad(1_250_000)).toBe('$12,500')
    expect(formatCad(1_250_050)).toBe('$12,500.50')
  })

  it('respects explicit cents modes', () => {
    expect(formatCad(1_250_000, { cents: 'always' })).toBe('$12,500.00')
    expect(formatCad(1_250_050, { cents: 'never' })).toBe('$12,501')
  })

  it('supports compact notation', () => {
    expect(formatCad(1_250_000, { compact: true })).toBe('$12.5K')
  })
})

describe('helpers', () => {
  it('sums cents', () => {
    expect(sumCents([])).toBe(0)
    expect(sumCents([100, 250, 1])).toBe(351)
  })

  it('validates cents', () => {
    expect(isValidCents(0)).toBe(true)
    expect(isValidCents(MAX_CENTS)).toBe(true)
    expect(isValidCents(-1)).toBe(false)
    expect(isValidCents(1.5)).toBe(false)
    expect(isValidCents(MAX_CENTS + 1)).toBe(false)
  })

  it('formats percentages', () => {
    expect(formatPercent(0.456)).toBe('46%')
    expect(formatPercent(1.25)).toBe('125%')
  })
})
