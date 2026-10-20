import { describe, expect, it } from 'vitest'

import {
  budgetIndexFromFigures,
  budgetShare,
  computeGuestFigures,
  formatShare,
  SHARE_SCALE,
} from './guestFigures'
import { deleted, SnapshotBuilder } from './testing/factories'

describe('budgetShare', () => {
  it('is parts per million of the total, rounded half up', () => {
    expect(budgetShare(25_000, 100_000)).toBe(250_000)
    expect(budgetShare(1, 3)).toBe(333_333)
    expect(budgetShare(2, 3)).toBe(666_667)
    expect(budgetShare(1, 2_000_000)).toBe(1) // exactly 0.5 rounds up
    expect(budgetShare(100_000, 100_000)).toBe(SHARE_SCALE)
  })

  it('is 0 when there is no total budget', () => {
    expect(budgetShare(5_000, 0)).toBe(0)
  })

  it('stays exact for the largest amounts', () => {
    expect(budgetShare(99_999_999_999, 99_999_999_999)).toBe(SHARE_SCALE)
    expect(budgetShare(1, 99_999_999_999)).toBe(0)
    // Paid can exceed the total budget by a lot.
    expect(budgetShare(5_000 * 99_999_999_999, 99_999_999_999)).toBe(5_000 * SHARE_SCALE)
  })
})

/** Two events; the Reception is over budget, the Mehndi has a deleted payment. */
function sample(mode: 'auto' | 'manual' = 'auto') {
  return new SnapshotBuilder(mode, 200_000)
    .event('mehndi', 50_000)
    .category('m-food', 'mehndi', 'food', 40_000)
    .activity('caterer', 'm-food', 30_000)
    .payment('p1', 'caterer', 10_000)
    .payment('p-gone', 'caterer', 99_000, deleted)
    .event('reception', 100_000)
    .category('r-decor', 'reception', 'decor', 60_000)
    .activity('florals', 'r-decor', 10_000)
    .payment('p2', 'florals', 10_001)
    .activity('lights', 'r-decor', 0)
    .build()
}

describe('computeGuestFigures', () => {
  it('expresses auto-mode budgets as shares of the summed total', () => {
    const f = computeGuestFigures(sample())
    // Total 40,000 cents: caterer 30,000, florals 10,000.
    expect(f.wedding).toEqual({
      budget: SHARE_SCALE,
      paid: 500_025,
      child: SHARE_SCALE,
      over: false,
    })
    expect(f.events.mehndi).toEqual({ budget: 750_000, paid: 250_000, child: 750_000, over: false })
    expect(f.events.reception).toEqual({
      budget: 250_000,
      paid: 250_025,
      child: 250_000,
      over: true,
    })
    expect(f.activities.caterer).toEqual({
      budget: 750_000,
      paid: 250_000,
      over: false,
      payments: 1,
    })
    expect(f.activities.florals).toEqual({
      budget: 250_000,
      paid: 250_025,
      over: true,
      payments: 1,
    })
    expect(f.activities.lights).toEqual({ budget: 0, paid: 0, over: false, payments: 0 })
  })

  it('uses each level’s own amount in manual mode, against the wedding’s manual budget', () => {
    const f = computeGuestFigures(sample('manual'))
    // Total 200,000 cents.
    expect(f.wedding).toMatchObject({ budget: SHARE_SCALE, child: 750_000 })
    expect(f.events.mehndi).toMatchObject({ budget: 250_000, child: 200_000 })
    expect(f.categories['r-decor']).toMatchObject({ budget: 300_000, child: 50_000, over: false })
  })

  it('takes the over-budget flag from exact amounts, not rounded shares', () => {
    // Paid exceeds the budget by one cent, far below one part per million of the total.
    const s = new SnapshotBuilder()
      .event('e')
      .category('c', 'e', 'd')
      .activity('big', 'c', 99_000_000_000)
      .activity('tiny', 'c', 10_000)
      .payment('p', 'tiny', 10_001)
      .build()
    const f = computeGuestFigures(s)
    expect(f.activities.tiny).toMatchObject({ budget: 0, paid: 0, over: true })
  })

  it('reports zeros, but real over-budget flags, when there is no budget at all', () => {
    const s = new SnapshotBuilder()
      .event('e')
      .category('c', 'e', 'd')
      .activity('a', 'c', 0)
      .payment('p', 'a', 500)
      .build()
    const f = computeGuestFigures(s)
    expect(f.wedding).toEqual({ budget: 0, paid: 0, child: 0, over: true })
  })
})

describe('budgetIndexFromFigures', () => {
  it('rebuilds every level with shares in place of cents and no actual costs', () => {
    const snapshot = sample()
    const index = budgetIndexFromFigures(snapshot, computeGuestFigures(snapshot))
    expect(index.wedding.budgetCents).toBe(SHARE_SCALE)
    expect(index.events.get('reception')?.progress.overBudget).toBe(true)
    expect(index.activities.get('caterer')).toMatchObject({
      budgetCents: 750_000,
      paidCents: 250_000,
      actualCostCents: null,
      outstandingCents: null,
      paymentCount: 1,
    })
    expect(index.categoryDefinitions.get('decor')).toEqual({
      categoryDefinitionId: 'decor',
      budgetCents: 250_000,
      paidCents: 250_025,
      eventCount: 1,
    })
  })

  it('keeps the server’s over-budget flag even when shares round to equal', () => {
    const snapshot = sample()
    const figures = computeGuestFigures(snapshot)
    figures.activities.caterer = { budget: 100, paid: 100, over: true, payments: 1 }
    const progress = budgetIndexFromFigures(snapshot, figures).activities.get('caterer')!.progress
    expect(progress).toMatchObject({ overBudget: true, barPercent: 100 })
  })
})

describe('formatShare', () => {
  it('shows one decimal place, dropping a trailing zero', () => {
    expect(formatShare(125_000)).toBe('12.5%')
    expect(formatShare(SHARE_SCALE)).toBe('100%')
    expect(formatShare(0)).toBe('0%')
    expect(formatShare(2_500_000)).toBe('250%')
  })

  it('never shows a small non-zero share as 0%', () => {
    expect(formatShare(3)).toBe('<0.1%')
    expect(formatShare(1_000)).toBe('0.1%')
  })
})
