/**
 * Percentage mode for guests: every budget figure as a share of the wedding's total budget.
 *
 * The database computes these in `guest_view()` (so raw amounts never reach a guest's
 * browser); `computeGuestFigures` is the same calculation from a full snapshot, used to
 * test that the two agree. `budgetIndexFromFigures` turns the figures back into a
 * `BudgetIndex` so screens and charts work unchanged, with shares in place of cents.
 *
 * Shares are integer parts per million of the wedding total (`SHARE_SCALE` = 100%),
 * rounded half up. Over budget is decided from the real amounts, never from rounded shares.
 */
import {
  type ActivitySummary,
  type BudgetIndex,
  type CategoryDefinitionSummary,
  computeBudgetIndex,
  type LevelSummary,
  spendProgress,
  type SpendProgress,
} from './budget'
import { selectActive } from './hierarchy'
import type { GuestFigures, Id, ShareFigures, WeddingSnapshot } from './types'

/** 100% of the wedding's total budget. */
export const SHARE_SCALE = 1_000_000

/**
 * `amount` as parts per million of `total`, rounded half up; 0 when the total is 0.
 * Exact for any cents values (BigInt), matching `budget_share()` in SQL.
 */
export function budgetShare(amountCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0
  const total = BigInt(totalCents)
  return Number((BigInt(amountCents) * BigInt(SHARE_SCALE) * 2n + total) / (2n * total))
}

/** The figures a guest receives for a wedding in percentage mode. */
export function computeGuestFigures(snapshot: WeddingSnapshot): GuestFigures {
  const index = computeBudgetIndex(snapshot)
  const total = index.wedding.budgetCents
  const level = (s: LevelSummary): ShareFigures => ({
    budget: budgetShare(s.budgetCents, total),
    paid: budgetShare(s.paidCents, total),
    child: budgetShare(s.childBudgetsCents, total),
    over: s.progress.overBudget,
  })
  const byId = <T, R>(map: Map<Id, T>, fn: (value: T) => R) =>
    Object.fromEntries([...map].map(([id, value]) => [id, fn(value)]))

  return {
    wedding: level(index.wedding),
    events: byId(index.events, level),
    categories: byId(index.categories, level),
    activities: byId(index.activities, (a) => ({
      budget: budgetShare(a.budgetCents, total),
      paid: budgetShare(a.paidCents, total),
      over: a.overBudget,
      payments: a.paymentCount,
    })),
  }
}

/** Progress from shares, keeping the exact over-budget flag the server computed. */
function progressFrom(budget: number, paid: number, over: boolean): SpendProgress {
  const progress = spendProgress(budget, paid)
  if (progress.overBudget === over) return progress
  const barPercent = over ? 100 : progress.ratio === null ? 0 : Math.min(100, progress.ratio * 100)
  return { ...progress, overBudget: over, barPercent }
}

const NO_FIGURES: ShareFigures = { budget: 0, paid: 0, child: 0, over: false }

function levelFrom(f: ShareFigures = NO_FIGURES): LevelSummary {
  return {
    budgetCents: f.budget,
    paidCents: f.paid,
    childBudgetsCents: f.child,
    progress: progressFrom(f.budget, f.paid, f.over),
  }
}

/**
 * A `BudgetIndex` built from guest figures. Every `…Cents` field holds a share
 * (parts per million of the total) instead; actual costs are not shared with guests.
 */
export function budgetIndexFromFigures(
  snapshot: WeddingSnapshot,
  figures: GuestFigures,
): BudgetIndex {
  const active = selectActive(snapshot)

  const activities = new Map<Id, ActivitySummary>()
  for (const a of active.activities) {
    const f = figures.activities[a.id] ?? { budget: 0, paid: 0, over: false, payments: 0 }
    activities.set(a.id, {
      budgetCents: f.budget,
      actualCostCents: null,
      paidCents: f.paid,
      paymentCount: f.payments,
      outstandingCents: null,
      overBudget: f.over,
      overpaid: false,
      overpaidByCents: 0,
      progress: progressFrom(f.budget, f.paid, f.over),
    })
  }

  const categories = new Map<Id, LevelSummary>()
  const categoryDefinitions = new Map<Id, CategoryDefinitionSummary>()
  for (const c of active.eventCategories) {
    const summary = levelFrom(figures.categories[c.id])
    categories.set(c.id, summary)
    const totals = categoryDefinitions.get(c.categoryDefinitionId) ?? {
      categoryDefinitionId: c.categoryDefinitionId,
      budgetCents: 0,
      paidCents: 0,
      eventCount: 0,
    }
    totals.budgetCents += summary.budgetCents
    totals.paidCents += summary.paidCents
    totals.eventCount += 1
    categoryDefinitions.set(c.categoryDefinitionId, totals)
  }

  const events = new Map(active.events.map((e) => [e.id, levelFrom(figures.events[e.id])]))

  return {
    mode: snapshot.wedding.budgetMode,
    wedding: levelFrom(figures.wedding),
    events,
    categories,
    activities,
    categoryDefinitions,
  }
}

/** Formats a share as a percent of the total, e.g. 125_000 → "12.5%", 3 → "<0.1%". */
export function formatShare(share: number): string {
  if (share > 0 && share < 1_000) return '<0.1%'
  const percent = Math.round(share / 1_000) / 10
  return `${percent.toLocaleString('en-CA')}%`
}
