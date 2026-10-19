import { describe, expect, it } from 'vitest'

import {
  CHAT_TOOLS,
  chartNote,
  type ChatRef,
  EDIT_LIMITS,
  editNote,
  parseChartSpec,
  parseEditProposal,
  refLookup,
  refsOutline,
  validateRefs,
} from './chatTools'

const refs: ChatRef[] = [
  { ref: 'D1', kind: 'definition', name: 'Food' },
  { ref: 'E1', kind: 'event', name: 'Haldi (2027-06-10)' },
  { ref: 'C1', kind: 'category', name: 'Food' },
  { ref: 'A1', kind: 'activity', name: 'Caterer' },
  { ref: 'P1', kind: 'payment', name: 'Payment $500.00 on 2026-09-01' },
  { ref: 'L1', kind: 'link', name: 'Link Menu' },
]
const lookup = refLookup(refs)

const edit = (...changes: unknown[]) => parseEditProposal({ summary: 'Test', changes }, lookup)

describe('validateRefs', () => {
  it('accepts a well-formed list and treats a missing one as empty', () => {
    expect(validateRefs(refs)).toEqual({ ok: true, value: refs })
    expect(validateRefs(undefined)).toEqual({ ok: true, value: [] })
  })

  it.each([
    ['not a list', { E1: 'event' }],
    ['a prefix that doesn’t match the kind', [{ ref: 'A1', kind: 'event', name: 'x' }]],
    ['an unknown kind', [{ ref: 'X1', kind: 'photo', name: 'x' }]],
    ['a duplicate', [refs[1], refs[1]]],
    ['a name that is too long', [{ ref: 'E1', kind: 'event', name: 'x'.repeat(301) }]],
  ])('rejects %s', (_, value) => {
    expect(validateRefs(value).ok).toBe(false)
  })
})

describe('refsOutline', () => {
  it('lists shared categories, then the event tree indented by level', () => {
    expect(refsOutline(refs, '2026-10-19')).toBe(
      [
        'Today is 2026-10-19.',
        '',
        'Record references for tool calls. Use only these; never invent one.',
        '',
        'Shared categories:',
        'D1 Food',
        '',
        'Events › categories › activities › payments and links:',
        'E1 Haldi (2027-06-10)',
        '  C1 Food',
        '    A1 Caterer',
        '      P1 Payment $500.00 on 2026-09-01',
        '      L1 Link Menu',
      ].join('\n'),
    )
  })
})

describe('parseChartSpec', () => {
  const chart = (input: object) => parseChartSpec({ title: 'Chart', ...input }, lookup)

  it('fills in defaults', () => {
    expect(chart({ form: 'bars', groupBy: 'category' })).toEqual({
      ok: true,
      value: {
        form: 'bars',
        title: 'Chart',
        groupBy: 'category',
        splitBy: null,
        measures: ['budget'],
        scope: null,
        items: [],
        statuses: [],
        only: null,
        sort: 'value',
        top: null,
        cumulative: false,
        from: null,
        to: null,
      },
    })
  })

  it('accepts one shared category across events, filters and several figures', () => {
    expect(
      chart({
        form: 'bars',
        groupBy: 'event',
        scope: 'D1',
        measures: ['budget', 'paid', 'actual', 'paid'],
        statuses: ['booked'],
        items: ['E1'],
        only: 'overBudget',
        top: 5,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        scope: 'D1',
        measures: ['budget', 'paid', 'actual'],
        statuses: ['booked'],
        items: ['E1'],
        only: 'overBudget',
        top: 5,
        sort: 'natural',
      },
    })
  })

  it('draws months as columns unless a line is asked for, defaulting to paid', () => {
    expect(chart({ form: 'bars', groupBy: 'month' })).toMatchObject({
      ok: true,
      value: { form: 'columns', measures: ['paid'] },
    })
    expect(
      chart({
        form: 'line',
        groupBy: 'month',
        splitBy: 'event',
        cumulative: true,
        from: '2026-01',
      }),
    ).toMatchObject({ ok: true, value: { form: 'line', splitBy: 'event', cumulative: true } })
  })

  it('accepts a month range with any grouping, as payments in that period', () => {
    expect(
      chart({ form: 'bars', groupBy: 'activity', from: '2026-10', to: '2026-10' }),
    ).toMatchObject({ ok: true, value: { measures: ['paid'], from: '2026-10', to: '2026-10' } })
  })

  it('defaults to a donut where one fits, and columns where it doesn’t', () => {
    const form = (input: object) => {
      const result = chart({ groupBy: 'category', ...input })
      return result.ok ? result.value.form : result.error
    }
    expect(form({})).toBe('donut')
    expect(form({ measures: ['budget', 'paid'] })).toBe('bars')
    expect(form({ splitBy: 'event' })).toBe('bars')
    expect(form({ groupBy: 'month' })).toBe('columns')
    expect(form({ form: 'bars' })).toBe('bars')
  })

  it('always shows budget and paid on progress charts', () => {
    expect(chart({ form: 'progress', groupBy: 'activity', measures: ['count'] })).toMatchObject({
      ok: true,
      value: { measures: ['budget', 'paid'] },
    })
  })

  it.each([
    ['an unknown form', { form: 'radar', groupBy: 'event' }],
    ['a missing grouping', { form: 'bars', groupBy: undefined }],
    ['a line not over months', { form: 'line', groupBy: 'event' }],
    ['budget per month', { form: 'columns', groupBy: 'month', measures: ['budget'] }],
    ['a split donut', { form: 'donut', groupBy: 'event', splitBy: 'status' }],
    [
      'a split with two figures',
      { form: 'bars', groupBy: 'event', splitBy: 'status', measures: ['budget', 'paid'] },
    ],
    ['a donut with two figures', { form: 'donut', groupBy: 'event', measures: ['budget', 'paid'] }],
    ['a split by the same dimension', { form: 'bars', groupBy: 'event', splitBy: 'event' }],
    [
      'four figures',
      { form: 'bars', groupBy: 'event', measures: ['budget', 'paid', 'actual', 'count'] },
    ],
    ['an unknown reference', { form: 'bars', groupBy: 'event', scope: 'E9' }],
    ['a payment as scope', { form: 'bars', groupBy: 'event', scope: 'P1' }],
    ['an unknown status', { form: 'bars', groupBy: 'event', statuses: ['maybe'] }],
    ['a top of zero', { form: 'bars', groupBy: 'event', top: 0 }],
    ['running totals not over months', { form: 'bars', groupBy: 'event', cumulative: true }],
    [
      'budget in a month range',
      { form: 'bars', groupBy: 'event', from: '2026-10', measures: ['budget'] },
    ],
    ['progress in a month range', { form: 'progress', groupBy: 'event', from: '2026-10' }],
    [
      'an over-budget filter in a month range',
      { form: 'bars', groupBy: 'event', from: '2026-10', only: 'overBudget' },
    ],
    ['a bad month', { form: 'columns', groupBy: 'month', from: '2026-13' }],
    ['a reversed range', { form: 'columns', groupBy: 'month', from: '2026-06', to: '2026-01' }],
  ])('rejects %s with a reason', (_, input) => {
    const result = chart(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(5)
  })
})

describe('parseEditProposal', () => {
  it('parses dollar amounts to cents without floating point', () => {
    expect(
      edit(
        { op: 'update_activity', activity: 'A1', budget: '$1,250.10', actualCost: 'none' },
        { op: 'add_payment', activity: 'A1', amount: 0.3, date: '2026-10-19', note: ' deposit ' },
      ),
    ).toEqual({
      ok: true,
      value: {
        summary: 'Test',
        changes: [
          { op: 'update_activity', activity: 'A1', budgetCents: 125010, actualCostCents: null },
          {
            op: 'add_payment',
            activity: 'A1',
            amountCents: 30,
            date: '2026-10-19',
            note: 'deposit',
          },
        ],
      },
    })
  })

  it('lets later changes refer to records created earlier with "as"', () => {
    const result = edit(
      { op: 'create_event', as: 'N1', name: 'Sangeet', date: '2027-06-11' },
      { op: 'add_category', as: 'N2', event: 'N1', definition: 'D1' },
      { op: 'create_activity', as: 'N3', category: 'N2', name: 'DJ', budget: '800' },
      { op: 'add_payment', activity: 'N3', amount: '100', date: '2026-10-19' },
    )
    expect(result.ok).toBe(true)
  })

  it('ignores extra references given as context', () => {
    expect(
      edit({ op: 'create_activity', event: 'E1', category: 'C1', name: 'DJ', budget: '800' }),
    ).toMatchObject({ ok: true, value: { changes: [{ category: 'C1', budgetCents: 80000 }] } })
  })

  it('ignores empty fields that belong to other operations', () => {
    expect(
      edit({
        op: 'create_activity',
        category: 'C1',
        name: 'DJ',
        budget: '800',
        amount: '',
        date: null,
      }),
    ).toMatchObject({ ok: true, value: { changes: [{ budgetCents: 80000 }] } })
  })

  it('keeps a new category’s name only when no shared category is given', () => {
    expect(edit({ op: 'add_category', event: 'E1', name: 'Music' })).toMatchObject({
      ok: true,
      value: { changes: [{ op: 'add_category', definition: null, name: 'Music', as: null }] },
    })
  })

  it.each([
    ['an unknown op', { op: 'restore', target: 'A1' }, /"op"/],
    ['a made-up reference', { op: 'update_activity', activity: 'A9', name: 'x' }, /A9/],
    [
      'a reference of the wrong kind',
      { op: 'add_payment', activity: 'E1', amount: '1', date: '2026-01-01' },
      /event/,
    ],
    ['an update with nothing to change', { op: 'update_activity', activity: 'A1' }, /at least one/],
    [
      'a malformed amount',
      { op: 'add_payment', activity: 'A1', amount: '12.345', date: '2026-01-01' },
      /dollar/,
    ],
    [
      'a zero payment',
      { op: 'add_payment', activity: 'A1', amount: '0', date: '2026-01-01' },
      /more than/,
    ],
    ['an impossible date', { op: 'update_event', event: 'E1', date: '2026-02-30' }, /date/],
    ['an unknown status', { op: 'update_activity', activity: 'A1', status: 'maybe' }, /status/],
    ['a non-web link', { op: 'add_link', activity: 'A1', url: 'javascript:alert(1)' }, /https/],
    [
      'a category with neither definition nor name',
      { op: 'add_category', event: 'E1' },
      /definition/,
    ],
    [
      'an updated record that is only being created',
      { op: 'update_event', event: 'N1', name: 'x' },
      /N1/,
    ],
    ['deleting a shared category', { op: 'delete', target: 'D1' }, /definition/],
    [
      'a budget in the wrong field',
      { op: 'create_activity', category: 'C1', name: 'DJ', amount: '800' },
      /"amount" doesn’t apply to create_activity; it takes: .*budget/,
    ],
    ['a value from another operation', { op: 'delete', target: 'A1', name: 'x' }, /"name"/],
    ['a name that is too long', { op: 'update_event', event: 'E1', name: 'x'.repeat(121) }, /120/],
  ])('rejects %s, naming the change', (_, change, reason) => {
    const result = edit(change)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/^Change 1: /)
      expect(result.error).toMatch(reason)
    }
  })

  it('rejects a reused "as" name and an empty or oversized proposal', () => {
    expect(
      edit({ op: 'create_event', as: 'N1', name: 'A' }, { op: 'create_event', as: 'N1', name: 'B' })
        .ok,
    ).toBe(false)
    expect(edit().ok).toBe(false)
    const many = Array.from({ length: EDIT_LIMITS.changes + 1 }, () => ({
      op: 'delete',
      target: 'P1',
    }))
    expect(edit(...many).ok).toBe(false)
  })
})

describe('tool definitions and notes', () => {
  it('declares both tools with object schemas', () => {
    expect(CHAT_TOOLS.map((t) => [t.name, t.input_schema.type])).toEqual([
      ['show_chart', 'object'],
      ['propose_edit', 'object'],
    ])
  })

  it('records charts and proposals as short notes for the history', () => {
    expect(chartNote({ title: 'Status' } as Parameters<typeof chartNote>[0])).toBe(
      '[Showed a chart: Status]',
    )
    expect(editNote('Record the deposit', 'dismissed')).toBe(
      '[Proposed changes: Record the deposit — the planner dismissed it; nothing changed]',
    )
  })
})
