import { describe, expect, it } from 'vitest'

import { emptyActivityForm, parseActivityForm } from './activityForm'
import { linkLabelFallback, normalizeUrl, parseLinkForm } from './links'

const form = (values: Partial<typeof emptyActivityForm>) => ({ ...emptyActivityForm, ...values })

describe('parseActivityForm', () => {
  it('requires a name', () => {
    expect(parseActivityForm(form({ name: ' ' }))).toMatchObject({
      ok: false,
      errors: { name: expect.any(String) },
    })
  })

  it('treats a blank budget as $0 and a blank actual cost as unknown', () => {
    const result = parseActivityForm(form({ name: 'DJ' }))
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'DJ',
        status: 'idea',
        budgetCents: 0,
        actualCostCents: null,
        description: '',
        notes: '',
      },
    })
  })

  it('keeps an actual cost of $0 distinct from unknown', () => {
    const result = parseActivityForm(form({ name: 'Venue', actualCost: '0' }))
    expect(result.ok && result.value.actualCostCents).toBe(0)
  })

  it('parses money and trims text', () => {
    const result = parseActivityForm(
      form({
        name: ' Florals ',
        status: 'booked',
        budget: '$3,000',
        actualCost: '2750.50',
        notes: ' Peonies if in season ',
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      value: {
        name: 'Florals',
        status: 'booked',
        budgetCents: 300_000,
        actualCostCents: 275_050,
        notes: 'Peonies if in season',
      },
    })
  })

  it('reports invalid amounts on the right fields', () => {
    expect(parseActivityForm(form({ name: 'x', budget: '-5', actualCost: '1.234' }))).toMatchObject(
      {
        ok: false,
        errors: { budget: expect.any(String), actualCost: expect.any(String) },
      },
    )
  })
})

describe('links', () => {
  it.each([
    ['example.com/quote', 'https://example.com/quote'],
    ['  https://www.vendor.ca  ', 'https://www.vendor.ca/'],
    ['http://old-site.com', 'http://old-site.com/'],
  ])('normalises %j', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })

  it.each([
    '',
    'not a url',
    'javascript:alert(1)',
    'ftp://files.com',
    'localhost',
    'mailto:a@b.com',
  ])('rejects %j', (input) => {
    expect(normalizeUrl(input)).toBeNull()
  })

  it('suggests the site name as a label', () => {
    expect(linkLabelFallback('https://www.pinterest.com/pin/123')).toBe('pinterest.com')
  })

  it('validates the link form', () => {
    expect(parseLinkForm('vendor.ca', ' Quote ')).toEqual({
      ok: true,
      value: { url: 'https://vendor.ca/', label: 'Quote' },
    })
    expect(parseLinkForm('nope', '')).toMatchObject({
      ok: false,
      errors: { url: expect.any(String) },
    })
  })
})
