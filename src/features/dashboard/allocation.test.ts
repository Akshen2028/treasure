import { describe, expect, it } from 'vitest'

import { computeBudgetIndex } from '@/domain/budget'
import { selectActive } from '@/domain/hierarchy'
import { deleted, SnapshotBuilder } from '@/domain/testing/factories'

import { buildAllocation, categoryAllocation, eventAllocation } from './allocation'

const item = (id: string, budgetCents: number, paidCents = 0) => ({
  id,
  name: id,
  budgetCents,
  paidCents,
})

describe('buildAllocation', () => {
  it('sorts largest first and computes shares of the total', () => {
    const { rows, totalCents } = buildAllocation(
      [item('mehndi', 100), item('reception', 300), item('haldi', 100)],
      'budget',
    )
    expect(totalCents).toBe(500)
    expect(rows.map((r) => [r.id, r.share])).toEqual([
      ['reception', 0.6],
      ['haldi', 0.2],
      ['mehndi', 0.2],
    ])
  })

  it('switches to paid amounts and flags items paid beyond their budget', () => {
    const { rows } = buildAllocation([item('a', 100, 150), item('b', 300, 50)], 'paid')
    expect(rows.map((r) => [r.id, r.valueCents, r.overBudget])).toEqual([
      ['a', 150, true],
      ['b', 50, false],
    ])
  })

  it('has no shares when nothing is budgeted or paid', () => {
    const { rows, totalCents } = buildAllocation([item('a', 0), item('b', 0)], 'paid')
    expect(totalCents).toBe(0)
    expect(rows.every((r) => r.share === null)).toBe(true)
  })

  it('folds the tail beyond the row cap into Other, keeping the total exact', () => {
    const items = Array.from({ length: 11 }, (_, i) => item(`c${i}`, (i + 1) * 100))
    const { rows, totalCents } = buildAllocation(items, 'budget', 8)
    expect(rows).toHaveLength(8)
    expect(rows[7]).toMatchObject({ id: 'other', name: 'Other (4)', valueCents: 1000, folded: 4 })
    expect(rows.reduce((s, r) => s + r.valueCents, 0)).toBe(totalCents)
  })
})

describe('wedding allocations', () => {
  const snapshot = new SnapshotBuilder()
    .event('mehndi', 0, { name: 'Mehndi' })
    .event('reception', 0, { name: 'Reception' })
    .event('haldi', 0, deleted)
    .category('m-decor', 'mehndi', 'decor')
    .activity('m1', 'm-decor', 100_000)
    .category('r-decor', 'reception', 'decor')
    .activity('r1', 'r-decor', 300_000)
    .category('r-food', 'reception', 'food')
    .activity('r2', 'r-food', 500_000)
    .category('h-decor', 'haldi', 'decor')
    .activity('h1', 'h-decor', 999_000)
    .payment('p1', 'r2', 200_000)
    .build()
  const active = selectActive(snapshot)
  const budget = computeBudgetIndex(snapshot)

  it('splits the budget across active events only', () => {
    const { rows, totalCents } = eventAllocation(active, budget, 'budget')
    expect(totalCents).toBe(900_000)
    expect(rows.map((r) => [r.name, r.valueCents])).toEqual([
      ['Reception', 800_000],
      ['Mehndi', 100_000],
    ])
  })

  it('sums each shared category across events', () => {
    const { rows } = categoryAllocation(active, budget, 'budget')
    expect(rows.map((r) => [r.id, r.valueCents])).toEqual([
      ['food', 500_000],
      ['decor', 400_000],
    ])
  })

  it('shows paid amounts per category', () => {
    const { rows, totalCents } = categoryAllocation(active, budget, 'paid')
    expect(totalCents).toBe(200_000)
    expect(rows[0]).toMatchObject({ id: 'food', valueCents: 200_000, share: 1 })
  })
})
