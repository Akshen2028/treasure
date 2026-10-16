import { describe, expect, it } from 'vitest'

import { emptyEventForm, parseEventForm } from './eventForm'

const form = (values: Partial<typeof emptyEventForm>) => ({ ...emptyEventForm, ...values })

describe('parseEventForm', () => {
  it('requires a name and trims text fields', () => {
    expect(parseEventForm(form({ name: '   ' }), 'auto')).toEqual({
      ok: false,
      errors: { name: 'Give the event a name.' },
    })
    expect(
      parseEventForm(
        form({ name: '  Mehndi ', location: ' Toronto ', eventDate: '2028-06-29' }),
        'auto',
      ),
    ).toEqual({
      ok: true,
      value: { name: 'Mehndi', eventDate: '2028-06-29', location: 'Toronto', description: '' },
    })
  })

  it('treats an empty date as no date', () => {
    const result = parseEventForm(form({ name: 'Haldi' }), 'auto')
    expect(result.ok && result.value.eventDate).toBeNull()
  })

  it('ignores the budget field in auto mode', () => {
    const result = parseEventForm(form({ name: 'Haldi', manualBudget: 'garbage' }), 'auto')
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && 'manualBudgetCents' in result.value).toBe(false)
  })

  it('parses the manual budget in manual mode, with blank meaning zero', () => {
    const parsed = parseEventForm(form({ name: 'Reception', manualBudget: '$25,000.50' }), 'manual')
    expect(parsed.ok && parsed.value.manualBudgetCents).toBe(2_500_050)
    const blank = parseEventForm(form({ name: 'Reception' }), 'manual')
    expect(blank.ok && blank.value.manualBudgetCents).toBe(0)
  })

  it('reports an invalid budget amount', () => {
    expect(
      parseEventForm(form({ name: 'Reception', manualBudget: '12.345' }), 'manual'),
    ).toMatchObject({
      ok: false,
      errors: { manualBudget: expect.any(String) },
    })
  })

  it('enforces the same length limits as the database', () => {
    const result = parseEventForm(
      form({ name: 'x'.repeat(121), location: 'y'.repeat(201) }),
      'auto',
    )
    expect(result).toMatchObject({
      ok: false,
      errors: { name: expect.any(String), location: expect.any(String) },
    })
  })
})
