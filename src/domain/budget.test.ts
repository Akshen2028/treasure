import { describe, expect, it } from 'vitest'

import {
  computeBudgetIndex,
  effectiveBudget,
  manualBudgetsFromCalculated,
  spendProgress,
  summarizeActivity,
} from './budget'
import { deleted, SnapshotBuilder, withChange, withWedding } from './testing/factories'
import type { WeddingSnapshot } from './types'

/** Budget and paid for each level, for compact assertions. */
function totals(snapshot: WeddingSnapshot) {
  const index = computeBudgetIndex(snapshot)
  const pick = (s: { budgetCents: number; paidCents: number } | undefined) =>
    s ? { budget: s.budgetCents, paid: s.paidCents } : undefined
  return {
    index,
    wedding: pick(index.wedding),
    event: (id: string) => pick(index.events.get(id)),
    category: (id: string) => pick(index.categories.get(id)),
    activity: (id: string) => pick(index.activities.get(id)),
  }
}

describe('effectiveBudget', () => {
  it('uses the child sum in auto mode, ignoring any stored manual amount', () => {
    expect(effectiveBudget('auto', 99_999, 12_345)).toBe(12_345)
  })

  it('uses the manual amount in manual mode, ignoring children', () => {
    expect(effectiveBudget('manual', 50_000, 12_345)).toBe(50_000)
    expect(effectiveBudget('manual', 0, 12_345)).toBe(0)
  })
})

describe('spendProgress', () => {
  it('reports a normal ratio', () => {
    expect(spendProgress(10_000, 2_500)).toEqual({
      ratio: 0.25,
      barPercent: 25,
      overBudget: false,
      remainingCents: 7_500,
    })
  })

  it('treats paid equal to budget as on budget, not over', () => {
    const p = spendProgress(10_000, 10_000)
    expect(p.overBudget).toBe(false)
    expect(p.barPercent).toBe(100)
    expect(p.remainingCents).toBe(0)
  })

  it('flags over budget and fills the bar', () => {
    const p = spendProgress(10_000, 12_000)
    expect(p.overBudget).toBe(true)
    expect(p.ratio).toBe(1.2)
    expect(p.barPercent).toBe(100)
    expect(p.remainingCents).toBe(-2_000)
  })

  it('handles a zero budget with nothing paid', () => {
    expect(spendProgress(0, 0)).toEqual({
      ratio: null,
      barPercent: 0,
      overBudget: false,
      remainingCents: 0,
    })
  })

  it('handles a zero budget with payments as over budget', () => {
    const p = spendProgress(0, 500)
    expect(p.ratio).toBeNull()
    expect(p.overBudget).toBe(true)
    expect(p.barPercent).toBe(100)
  })
})

describe('summarizeActivity', () => {
  it('has nothing paid and no outstanding amount before any payment or actual cost', () => {
    const s = summarizeActivity(100_000, null, [])
    expect(s.paidCents).toBe(0)
    expect(s.paymentCount).toBe(0)
    expect(s.outstandingCents).toBeNull()
    expect(s.overBudget).toBe(false)
    expect(s.overpaid).toBe(false)
  })

  it('sums multiple installment payments', () => {
    const s = summarizeActivity(500_000, null, [100_000, 150_000, 25_050])
    expect(s.paidCents).toBe(275_050)
    expect(s.paymentCount).toBe(3)
  })

  it('calculates outstanding as max(0, actual − paid) only when actual cost is known', () => {
    expect(summarizeActivity(500_000, 450_000, [100_000, 200_000]).outstandingCents).toBe(150_000)
    expect(summarizeActivity(500_000, 300_000, [100_000, 200_000]).outstandingCents).toBe(0)
    expect(summarizeActivity(500_000, 300_000, [400_000]).outstandingCents).toBe(0)
    expect(summarizeActivity(500_000, null, [400_000]).outstandingCents).toBeNull()
  })

  it('flags over budget without inferring overpaid when actual cost is unknown', () => {
    const s = summarizeActivity(100_000, null, [120_000])
    expect(s.overBudget).toBe(true)
    expect(s.overpaid).toBe(false)
    expect(s.overpaidByCents).toBe(0)
  })

  it('flags overpaid without over budget when actual cost is below budget', () => {
    const s = summarizeActivity(500_000, 100_000, [150_000])
    expect(s.overBudget).toBe(false)
    expect(s.overpaid).toBe(true)
    expect(s.overpaidByCents).toBe(50_000)
  })

  it('flags both conditions independently when both apply', () => {
    const s = summarizeActivity(100_000, 120_000, [150_000])
    expect(s.overBudget).toBe(true)
    expect(s.overpaid).toBe(true)
    expect(s.overpaidByCents).toBe(30_000)
  })

  it('does not flag paying exactly the actual cost as overpaid', () => {
    const s = summarizeActivity(100_000, 80_000, [50_000, 30_000])
    expect(s.overpaid).toBe(false)
    expect(s.outstandingCents).toBe(0)
  })

  it('handles a zero budget and zero actual cost', () => {
    const free = summarizeActivity(0, 0, [])
    expect(free.overBudget).toBe(false)
    expect(free.overpaid).toBe(false)
    expect(free.outstandingCents).toBe(0)

    const paidAnyway = summarizeActivity(0, 0, [100])
    expect(paidAnyway.overBudget).toBe(true)
    expect(paidAnyway.overpaid).toBe(true)
  })
})

/**
 * Shared fixture: two events, three categories. Every level also carries a
 * manual amount, so the same data can be checked in both modes.
 */
const twoEvents = (mode: 'auto' | 'manual') =>
  new SnapshotBuilder(mode, 3_000_000)
    .event('mehndi', 700_000)
    .category('mehndi-food', 'mehndi', 'food', 500_000)
    .activity('caterer', 'mehndi-food', 400_000)
    .activity('chai-bar', 'mehndi-food', 50_000)
    .category('mehndi-decor', 'mehndi', 'decor', 200_000)
    .activity('florals', 'mehndi-decor', 150_000)
    .event('reception', 1_500_000)
    .category('reception-venue', 'reception', 'venue', 1_200_000)
    .activity('hall', 'reception-venue', 1_000_000)
    .payment('p1', 'caterer', 100_000)
    .payment('p2', 'caterer', 50_000)
    .payment('p3', 'hall', 250_000)
    .build()

describe('computeBudgetIndex: auto mode', () => {
  const snapshot = twoEvents('auto')

  it('bubbles activity budgets up through every level, ignoring stored manual amounts', () => {
    const t = totals(snapshot)
    expect(t.index.mode).toBe('auto')
    expect(t.category('mehndi-food')).toEqual({ budget: 450_000, paid: 150_000 })
    expect(t.category('mehndi-decor')).toEqual({ budget: 150_000, paid: 0 })
    expect(t.event('mehndi')).toEqual({ budget: 600_000, paid: 150_000 })
    expect(t.event('reception')).toEqual({ budget: 1_000_000, paid: 250_000 })
    expect(t.wedding).toEqual({ budget: 1_600_000, paid: 400_000 })
  })

  it('propagates an activity budget change to every level', () => {
    const t = totals(withChange(snapshot, 'activities', 'chai-bar', { budgetCents: 80_000 }))
    expect(t.category('mehndi-food')?.budget).toBe(480_000)
    expect(t.event('mehndi')?.budget).toBe(630_000)
    expect(t.wedding?.budget).toBe(1_630_000)
  })

  it('reports budget equal to the child sum at every level', () => {
    const { index } = totals(snapshot)
    for (const level of [index.wedding, ...index.events.values(), ...index.categories.values()]) {
      expect(level.budgetCents).toBe(level.childBudgetsCents)
    }
  })
})

describe('computeBudgetIndex: manual mode', () => {
  const snapshot = twoEvents('manual')

  it('uses each level’s own amount', () => {
    const t = totals(snapshot)
    expect(t.index.mode).toBe('manual')
    expect(t.category('mehndi-food')).toEqual({ budget: 500_000, paid: 150_000 })
    expect(t.category('mehndi-decor')).toEqual({ budget: 200_000, paid: 0 })
    expect(t.event('mehndi')).toEqual({ budget: 700_000, paid: 150_000 })
    expect(t.event('reception')).toEqual({ budget: 1_500_000, paid: 250_000 })
    expect(t.wedding).toEqual({ budget: 3_000_000, paid: 400_000 })
  })

  it('never changes any level when an activity budget changes', () => {
    const t = totals(withChange(snapshot, 'activities', 'chai-bar', { budgetCents: 999_000 }))
    expect(t.category('mehndi-food')?.budget).toBe(500_000)
    expect(t.event('mehndi')?.budget).toBe(700_000)
    expect(t.wedding?.budget).toBe(3_000_000)
  })

  it('never changes a parent when a child’s manual amount changes', () => {
    let s = withChange(snapshot, 'eventCategories', 'mehndi-food', { manualBudgetCents: 900_000 })
    s = withChange(s, 'events', 'reception', { manualBudgetCents: 50_000 })
    const t = totals(s)
    expect(t.category('mehndi-food')?.budget).toBe(900_000)
    expect(t.event('mehndi')?.budget).toBe(700_000)
    expect(t.wedding?.budget).toBe(3_000_000)
  })

  it('still reports the child sum for context', () => {
    const { index } = totals(snapshot)
    expect(index.categories.get('mehndi-food')?.childBudgetsCents).toBe(450_000)
    expect(index.events.get('mehndi')?.childBudgetsCents).toBe(700_000)
    expect(index.wedding.childBudgetsCents).toBe(2_200_000)
  })

  it('rolls paid up from payments exactly as in auto mode', () => {
    const auto = totals(twoEvents('auto'))
    const manual = totals(snapshot)
    expect(manual.wedding?.paid).toBe(auto.wedding?.paid)
    expect(manual.event('mehndi')?.paid).toBe(auto.event('mehndi')?.paid)
    expect(manual.category('mehndi-food')?.paid).toBe(auto.category('mehndi-food')?.paid)
  })

  it('can be over budget at one level and under at another', () => {
    const s = withChange(snapshot, 'eventCategories', 'mehndi-food', { manualBudgetCents: 100_000 })
    const { index } = totals(s)
    expect(index.categories.get('mehndi-food')?.progress.overBudget).toBe(true)
    expect(index.events.get('mehndi')?.progress.overBudget).toBe(false)
  })
})

describe('switching budget mode', () => {
  it('keeps manual amounts intact through a round trip to auto and back', () => {
    const manual = twoEvents('manual')
    const roundTrip = withWedding(withWedding(manual, { budgetMode: 'auto' }), {
      budgetMode: 'manual',
    })
    expect(totals(roundTrip).wedding).toEqual(totals(manual).wedding)
    expect(totals(roundTrip).event('mehndi')).toEqual(totals(manual).event('mehndi'))
  })

  it('seeds manual amounts from the calculated totals so nothing jumps', () => {
    const auto = twoEvents('auto')
    const seed = manualBudgetsFromCalculated(auto)
    expect(seed.weddingCents).toBe(1_600_000)
    expect(seed.events.get('mehndi')).toBe(600_000)
    expect(seed.events.get('reception')).toBe(1_000_000)
    expect(seed.categories.get('mehndi-food')).toBe(450_000)
    expect(seed.categories.get('mehndi-decor')).toBe(150_000)
    expect(seed.categories.get('reception-venue')).toBe(1_000_000)
  })

  it('produces identical budgets after switching with the seeded amounts', () => {
    const auto = twoEvents('auto')
    const seed = manualBudgetsFromCalculated(auto)
    let s = withWedding(auto, { budgetMode: 'manual', manualBudgetCents: seed.weddingCents })
    for (const [id, cents] of seed.events)
      s = withChange(s, 'events', id, { manualBudgetCents: cents })
    for (const [id, cents] of seed.categories) {
      s = withChange(s, 'eventCategories', id, { manualBudgetCents: cents })
    }

    const before = computeBudgetIndex(auto)
    const after = computeBudgetIndex(s)
    expect(after.wedding.budgetCents).toBe(before.wedding.budgetCents)
    for (const [id, summary] of before.events) {
      expect(after.events.get(id)?.budgetCents).toBe(summary.budgetCents)
    }
    for (const [id, summary] of before.categories) {
      expect(after.categories.get(id)?.budgetCents).toBe(summary.budgetCents)
    }
  })

  it('seeds from the calculated totals even when called in manual mode', () => {
    expect(manualBudgetsFromCalculated(twoEvents('manual')).weddingCents).toBe(1_600_000)
  })

  it('leaves deleted records out of the seed', () => {
    const s = withChange(twoEvents('auto'), 'events', 'reception', deleted)
    const seed = manualBudgetsFromCalculated(s)
    expect(seed.weddingCents).toBe(600_000)
    expect(seed.events.has('reception')).toBe(false)
    expect(seed.categories.has('reception-venue')).toBe(false)
  })
})

describe('computeBudgetIndex: zero and empty budgets', () => {
  it('reports zero for an empty wedding', () => {
    const t = totals(new SnapshotBuilder().build())
    expect(t.wedding).toEqual({ budget: 0, paid: 0 })
    expect(t.index.wedding.progress.ratio).toBeNull()
    expect(t.index.wedding.progress.overBudget).toBe(false)
  })

  it('gives levels without children a zero budget in auto mode', () => {
    const t = totals(new SnapshotBuilder().event('e').category('c', 'e', 'food').build())
    expect(t.category('c')).toEqual({ budget: 0, paid: 0 })
    expect(t.event('e')).toEqual({ budget: 0, paid: 0 })
  })

  it('respects a manual zero budget, and flags it over budget once paid', () => {
    const t = totals(
      new SnapshotBuilder('manual', 0)
        .event('e', 0)
        .category('c', 'e', 'food', 0)
        .activity('a', 'c', 50_000)
        .payment('p', 'a', 100)
        .build(),
    )
    expect(t.event('e')).toEqual({ budget: 0, paid: 100 })
    expect(t.index.events.get('e')?.progress.overBudget).toBe(true)
    expect(t.wedding?.budget).toBe(0)
  })
})

describe('computeBudgetIndex: soft-deleted records', () => {
  const snapshot = new SnapshotBuilder()
    .event('e1')
    .category('c1', 'e1', 'food')
    .activity('a1', 'c1', 100_000)
    .activity('a2', 'c1', 200_000)
    .category('c2', 'e1', 'decor')
    .activity('a3', 'c2', 300_000)
    .event('e2')
    .category('c3', 'e2', 'venue')
    .activity('a4', 'c3', 400_000)
    .payment('p1', 'a1', 10_000)
    .payment('p2', 'a1', 20_000)
    .payment('p3', 'a2', 30_000)
    .payment('p4', 'a3', 40_000)
    .payment('p5', 'a4', 50_000)
    .build()

  it('baseline', () => {
    expect(totals(snapshot).wedding).toEqual({ budget: 1_000_000, paid: 150_000 })
  })

  it('excludes a deleted payment from paid at every level', () => {
    const t = totals(withChange(snapshot, 'payments', 'p2', deleted))
    expect(t.activity('a1')?.paid).toBe(10_000)
    expect(t.index.activities.get('a1')?.paymentCount).toBe(1)
    expect(t.category('c1')?.paid).toBe(40_000)
    expect(t.wedding).toEqual({ budget: 1_000_000, paid: 130_000 })
  })

  it('excludes a deleted activity budget and its payments', () => {
    const t = totals(withChange(snapshot, 'activities', 'a1', deleted))
    expect(t.activity('a1')).toBeUndefined()
    expect(t.category('c1')).toEqual({ budget: 200_000, paid: 30_000 })
    expect(t.wedding).toEqual({ budget: 900_000, paid: 120_000 })
  })

  it('excludes a deleted category and everything under it', () => {
    const t = totals(withChange(snapshot, 'eventCategories', 'c1', deleted))
    expect(t.category('c1')).toBeUndefined()
    expect(t.activity('a1')).toBeUndefined()
    expect(t.activity('a2')).toBeUndefined()
    expect(t.event('e1')).toEqual({ budget: 300_000, paid: 40_000 })
    expect(t.wedding).toEqual({ budget: 700_000, paid: 90_000 })
  })

  it('excludes a deleted event and everything under it', () => {
    const t = totals(withChange(snapshot, 'events', 'e1', deleted))
    expect(t.event('e1')).toBeUndefined()
    expect(t.category('c2')).toBeUndefined()
    expect(t.activity('a3')).toBeUndefined()
    expect(t.wedding).toEqual({ budget: 400_000, paid: 50_000 })
  })

  it('in manual mode, excludes a deleted event’s budget and payments from the wedding paid only', () => {
    let s = withWedding(snapshot, { budgetMode: 'manual', manualBudgetCents: 2_000_000 })
    s = withChange(s, 'events', 'e1', deleted)
    const t = totals(s)
    expect(t.wedding).toEqual({ budget: 2_000_000, paid: 50_000 })
    expect(t.index.wedding.childBudgetsCents).toBe(0)
  })
})

describe('computeBudgetIndex: restoring deleted records', () => {
  const original = new SnapshotBuilder()
    .event('e1')
    .category('c1', 'e1', 'food')
    .activity('a1', 'c1', 100_000)
    .activity('a2', 'c1', 200_000)
    .payment('p1', 'a1', 10_000)
    .payment('p2', 'a2', 20_000)
    .build()
  const restored = { deletedAt: null }

  it('restoring a payment returns totals to exactly the original, without duplication', () => {
    const removed = withChange(original, 'payments', 'p1', deleted)
    const back = withChange(removed, 'payments', 'p1', restored)
    expect(totals(back).wedding).toEqual(totals(original).wedding)
    expect(totals(back).index.activities.get('a1')?.paymentCount).toBe(1)
  })

  it('restoring a parent brings back children that were not deleted separately', () => {
    const removed = withChange(original, 'events', 'e1', deleted)
    expect(totals(removed).wedding).toEqual({ budget: 0, paid: 0 })
    const back = withChange(removed, 'events', 'e1', restored)
    expect(totals(back).wedding).toEqual(totals(original).wedding)
  })

  it('keeps a separately deleted child deleted after its parent is restored', () => {
    let s = withChange(original, 'activities', 'a2', deleted) // deleted first, on its own
    s = withChange(s, 'eventCategories', 'c1', deleted) // then the parent
    s = withChange(s, 'eventCategories', 'c1', restored) // parent restored
    const t = totals(s)
    expect(t.activity('a1')).toBeDefined()
    expect(t.activity('a2')).toBeUndefined()
    expect(t.wedding).toEqual({ budget: 100_000, paid: 10_000 })
  })
})

describe('computeBudgetIndex: shared categories across events', () => {
  const snapshot = new SnapshotBuilder()
    .event('mehndi')
    .category('m-decor', 'mehndi', 'decor', 500_000)
    .activity('m-florals', 'm-decor', 150_000)
    .category('m-food', 'mehndi', 'food')
    .activity('m-caterer', 'm-food', 400_000)
    .event('reception')
    .category('r-decor', 'reception', 'decor', 300_000)
    .activity('r-lighting', 'r-decor', 80_000)
    .event('haldi')
    .category('h-decor', 'haldi', 'decor', 40_000)
    .activity('h-marigolds', 'h-decor', 20_000)
    .payment('p1', 'm-florals', 50_000)
    .payment('p2', 'r-lighting', 80_000)
    .payment('p3', 'h-marigolds', 5_000)
    .definition('photographer', 'Photographer')
    .build()

  it('aggregates the same category across every event (auto)', () => {
    const decor = computeBudgetIndex(snapshot).categoryDefinitions.get('decor')
    expect(decor).toEqual({
      categoryDefinitionId: 'decor',
      budgetCents: 150_000 + 80_000 + 20_000,
      paidCents: 50_000 + 80_000 + 5_000,
      eventCount: 3,
    })
  })

  it('aggregates manual category amounts in manual mode', () => {
    const s = withWedding(snapshot, { budgetMode: 'manual' })
    const decor = computeBudgetIndex(s).categoryDefinitions.get('decor')
    expect(decor?.budgetCents).toBe(500_000 + 300_000 + 40_000)
    expect(decor?.paidCents).toBe(135_000)
  })

  it('keeps distinct categories separate', () => {
    const food = computeBudgetIndex(snapshot).categoryDefinitions.get('food')
    expect(food).toMatchObject({ budgetCents: 400_000, paidCents: 0, eventCount: 1 })
  })

  it('omits definitions that no active event uses', () => {
    expect(computeBudgetIndex(snapshot).categoryDefinitions.has('photographer')).toBe(false)
  })

  it('excludes deleted events and categories from the aggregate', () => {
    let s = withChange(snapshot, 'events', 'haldi', deleted)
    s = withChange(s, 'eventCategories', 'r-decor', deleted)
    const decor = computeBudgetIndex(s).categoryDefinitions.get('decor')
    expect(decor).toEqual({
      categoryDefinitionId: 'decor',
      budgetCents: 150_000,
      paidCents: 50_000,
      eventCount: 1,
    })
  })

  it('in auto mode, category, event and wedding totals all agree', () => {
    const index = computeBudgetIndex(snapshot)
    const sum = (values: Iterable<{ budgetCents: number }>) =>
      [...values].reduce((total, v) => total + v.budgetCents, 0)
    expect(sum(index.categoryDefinitions.values())).toBe(index.wedding.budgetCents)
    expect(sum(index.events.values())).toBe(index.wedding.budgetCents)
  })
})
