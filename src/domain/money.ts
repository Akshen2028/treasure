/**
 * CAD money helpers. All amounts are integer cents; conversion to and from text
 * never goes through floating-point arithmetic.
 */

/** Largest amount accepted from input: $999,999,999.99. */
export const MAX_CENTS = 99_999_999_999

export function isValidCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS
}

export function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}

type FormatOptions = {
  /** 'auto' shows cents only when the amount has a fractional part. */
  cents?: 'auto' | 'always' | 'never'
  /** Compact notation for tight spaces, e.g. "$12.5K". */
  compact?: boolean
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(fractionDigits: number, compact: boolean): Intl.NumberFormat {
  const key = `${fractionDigits}:${compact}`
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: compact ? 0 : fractionDigits,
      maximumFractionDigits: compact ? 1 : fractionDigits,
      notation: compact ? 'compact' : 'standard',
    })
    formatters.set(key, fmt)
  }
  return fmt
}

/** Formats integer cents as CAD, e.g. 1250050 → "$12,500.50". */
export function formatCad(cents: number, options: FormatOptions = {}): string {
  const { cents: centsMode = 'auto', compact = false } = options
  const hasFraction = cents % 100 !== 0
  const digits = centsMode === 'always' || (centsMode === 'auto' && hasFraction) ? 2 : 0
  // Dividing for display only; the stored value stays an integer.
  return formatter(digits, compact).format(cents / 100)
}

/** Formats cents for an editable input, e.g. 1250050 → "12500.50", 1250000 → "12500". */
export function centsToInput(cents: number): string {
  const dollars = Math.trunc(cents / 100)
  const remainder = Math.abs(cents % 100)
  return remainder === 0 ? String(dollars) : `${dollars}.${String(remainder).padStart(2, '0')}`
}

/**
 * Parses user input into integer cents. Accepts "$1,234.56", "1234.5", "1234",
 * ".5" and surrounding whitespace. Returns null for empty, negative, malformed,
 * more than two decimals, or amounts above MAX_CENTS.
 */
export function parseCadInput(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '').trim()
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned)
  if (!match) return null
  const [, whole = '', fraction = ''] = match
  if (whole === '' && fraction === '') return null
  if (whole.length > 12) return null

  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  return isValidCents(cents) ? cents : null
}

/** Formats a 0..1+ ratio as a whole percent, e.g. 0.456 → "46%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}
