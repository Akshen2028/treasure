import { describe, expect, it } from 'vitest'

import type { WeddingData } from '@/data/queries'
import { computeBudgetIndex } from '@/domain/budget'
import type { ChartSpec } from '@/domain/chatTools'
import { selectActive } from '@/domain/hierarchy'
import { SnapshotBuilder } from '@/domain/testing/factories'
import type { WeddingSnapshot } from '@/domain/types'

import { buildChatChart, DEFAULT_ROW_CAP, type ChatChartData } from './chatCharts'
import { buildChatRefs } from './chatRefs'

function wedding(mode: 'auto' | 'manual' = 'auto') {
  return new SnapshotBuilder(mode, 900000)
    .event('Haldi', 400000, { eventDate: '2027-06-10' })
    .category('haldi-food', 'Haldi', 'food', 350000)
    .activity('Caterer', 'haldi-food', 300000, { status: 'booked', actualCostCents: 320000 })
    .activity('Sweets', 'haldi-food', 20000, { status: 'idea' })
    .payment('p1', 'Caterer', 50000, { paidOn: '2026-05-03' })
    .payment('p2', 'Caterer', 400000, { paidOn: '2026-05-20' })
    .payment('p3', 'Sweets', 5000, { paidOn: '2026-07-01' })
    .event('Reception', 500000, { eventDate: '2027-06-12' })
    .category('rec-food', 'Reception', 'food', 200000)
    .activity('Buffet', 'rec-food', 150000, { status: 'planned' })
    .payment('p4', 'Buffet', 30000, { paidOn: '2026-07-15' })
    .category('rec-decor', 'Reception', 'decor', 100000)
    .activity('Flowers', 'rec-decor', 100000)
    .build()
}

function setup(snapshot: WeddingSnapshot = wedding()) {
  const data: WeddingData = {
    snapshot,
    active: selectActive(snapshot),
    budget: computeBudgetIndex(snapshot),
  }
  const { targets, refs } = buildChatRefs(data.active)
  const ref = (name: string) => refs.find((r) => r.name.startsWith(name))!.ref
  const chart = (spec: Partial<ChartSpec>) =>
    buildChatChart(
      {
        form: 'bars',
        title: 'Chart',
        groupBy: 'event',
        splitBy: null,
        measures: ['budget'],
        scope: null,
        items: [],
        statuses: [],
        only: null,
        sort: 'natural',
        top: null,
        cumulative: false,
        from: null,
        to: null,
        ...spec,
      },
      data,
      targets,
    )
  return { chart, ref, refs }
}

function ok(result: ChatChartData) {
  if (result.kind !== 'chart') throw new Error(result.message)
  return result
}
const table = (result: ChatChartData) => ok(result).rows.map((r) => [r.name, ...r.values])

describe('buildChatChart', () => {
  it('compares figures by event, in event order', () => {
    const { chart } = setup()
    expect(table(chart({ measures: ['budget', 'paid', 'stillToPay'] }))).toEqual([
      ['Haldi', 320000, 455000, 0],
      ['Reception', 250000, 30000, 0],
    ])
  })

  it('charts one shared category across events', () => {
    const { chart, ref } = setup()
    expect(table(chart({ scope: ref('food'), measures: ['budget', 'paid'] }))).toEqual([
      ['Haldi', 320000, 455000],
      ['Reception', 150000, 30000],
    ])
  })

  it('uses the levels’ own budgets in manual mode, and activity sums once filtered', () => {
    const { chart, ref } = setup(wedding('manual'))
    expect(table(chart({}))).toEqual([
      ['Haldi', 400000],
      ['Reception', 500000],
    ])
    expect(table(chart({ scope: ref('food') }))).toEqual([
      ['Haldi', 350000],
      ['Reception', 200000],
    ])
    expect(table(chart({ groupBy: 'none' }))).toEqual([['Whole wedding', 900000]])
    expect(table(chart({ statuses: ['booked'] }))).toEqual([['Haldi', 300000]])
  })

  it('splits each shared category by event', () => {
    const { chart } = setup()
    const result = ok(chart({ groupBy: 'category', splitBy: 'event', sort: 'value' }))
    expect(result.series.map((s) => s.name)).toEqual(['Haldi', 'Reception'])
    expect(result.rows.map((r) => [r.name, r.values[0], ...r.parts])).toEqual([
      ['food', 470000, 320000, 150000],
      ['decor', 100000, 0, 100000],
    ])
  })

  it('totals money and counts by status', () => {
    const { chart } = setup()
    expect(table(chart({ groupBy: 'status', measures: ['budget', 'count'] }))).toEqual([
      ['Idea', 20000, 1],
      ['Planned', 250000, 2],
      ['Booked', 300000, 1],
    ])
  })

  it('charts payments per month, filling gaps, with running totals and a range', () => {
    const { chart } = setup()
    expect(
      table(chart({ form: 'columns', groupBy: 'month', measures: ['paid', 'count'] })),
    ).toEqual([
      ['May 2026', 450000, 2],
      ['Jun 2026', 0, 0],
      ['Jul 2026', 35000, 2],
    ])
    expect(
      table(
        chart({
          form: 'line',
          groupBy: 'month',
          measures: ['paid'],
          cumulative: true,
          from: '2026-06',
        }),
      ),
    ).toEqual([
      ['Jun 2026', 450000],
      ['Jul 2026', 485000],
    ])
  })

  it('totals what was paid in a month range by activity', () => {
    const { chart } = setup()
    expect(
      table(
        chart({
          groupBy: 'activity',
          measures: ['paid', 'count'],
          from: '2026-07',
          to: '2026-07',
          sort: 'value',
        }),
      ),
    ).toEqual([
      ['Buffet', 30000, 1],
      ['Sweets', 5000, 1],
    ])
    expect(chart({ groupBy: 'event', measures: ['paid'], from: '2026-08' })).toMatchObject({
      kind: 'missing',
      message: 'No payments in that period.',
    })
  })

  it('splits payments per month by event', () => {
    const { chart } = setup()
    const result = ok(
      chart({ form: 'line', groupBy: 'month', measures: ['paid'], splitBy: 'event' }),
    )
    expect(result.rows.map((r) => [r.name, ...r.parts])).toEqual([
      ['May 2026', 450000, 0],
      ['Jun 2026', 0, 0],
      ['Jul 2026', 5000, 30000],
    ])
  })

  it('leaves out parts with nothing in the month range shown', () => {
    const { chart } = setup()
    const result = ok(
      chart({
        form: 'columns',
        groupBy: 'month',
        measures: ['paid'],
        splitBy: 'activity',
        from: '2026-07',
      }),
    )
    expect(result.series.map((s) => s.name)).toEqual(['Buffet', 'Sweets'])
    expect(result.rows.map((r) => [r.name, ...r.parts])).toEqual([['Jul 2026', 30000, 5000]])
  })

  it('compares hand-picked activities and filters to what is over budget', () => {
    const { chart, ref } = setup()
    expect(
      table(
        chart({
          groupBy: 'activity',
          items: [ref('Caterer'), ref('Buffet')],
          measures: ['budget', 'actual', 'paid'],
          sort: 'value',
        }),
      ),
    ).toEqual([
      ['Caterer', 300000, 320000, 450000],
      ['Buffet', 150000, 0, 30000],
    ])
    const over = ok(
      chart({
        form: 'progress',
        groupBy: 'activity',
        measures: ['budget', 'paid'],
        only: 'overBudget',
      }),
    )
    expect(over.rows.map((r) => [r.name, r.overBudget])).toEqual([['Caterer', true]])
  })

  it('keeps the largest rows and counts the rest', () => {
    const builder = new SnapshotBuilder().event('E').category('c', 'E', 'food')
    for (let i = 0; i < DEFAULT_ROW_CAP + 3; i++) builder.activity(`a${i}`, 'c', 100 + i)
    const { chart } = setup(builder.build())
    expect(ok(chart({ groupBy: 'activity' }))).toMatchObject({ hidden: 3 })
    const top = ok(chart({ groupBy: 'activity', top: 2, sort: 'value' }))
    expect(top.rows.map((r) => r.name)).toEqual(['a14', 'a13'])
  })

  it('tells duplicate activity names apart by event', () => {
    const snapshot = new SnapshotBuilder()
      .event('Haldi')
      .category('h', 'Haldi', 'food')
      .activity('dj-1', 'h', 100, { name: 'DJ' })
      .event('Sangeet')
      .category('s', 'Sangeet', 'food')
      .activity('dj-2', 's', 200, { name: 'DJ' })
      .build()
    const { chart } = setup(snapshot)
    expect(ok(chart({ groupBy: 'activity', sort: 'value' })).rows.map((r) => r.name)).toEqual([
      'DJ (Sangeet)',
      'DJ (Haldi)',
    ])
  })

  it('explains when the record is gone or nothing matches', () => {
    const { chart } = setup()
    expect(chart({ scope: 'E9' })).toMatchObject({ kind: 'missing' })
    expect(chart({ groupBy: 'activity', only: 'stillToPay' })).toMatchObject({
      kind: 'missing',
      message: 'Nothing matches that filter.',
    })
  })
})
