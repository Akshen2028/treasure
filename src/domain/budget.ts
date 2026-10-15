/**
 * Budget and payment calculations for Wedding → Event → Category → Activity.
 *
 * Rules
 * - Activity budget is always entered by hand; paid is the sum of its active payments.
 * - One wedding-wide mode decides every level above activities:
 *   - auto: each level's budget is the sum of its children, bubbling up from activities.
 *   - manual: each level uses its own entered amount and never changes with its children.
 * - Paid always rolls up from active payments, in both modes.
 * - Soft-deleted records, and records under a deleted ancestor, count for nothing.
 *
 * Everything here is pure and works on integer cents.
 */
import { selectActive } from './hierarchy'
import { sumCents } from './money'
import type { BudgetMode, Id, WeddingSnapshot } from './types'

/** The budget that applies at a level above activities. */
export function effectiveBudget(
  mode: BudgetMode,
  manualBudgetCents: number,
  childBudgetsCents: number,
): number {
  return mode === 'manual' ? manualBudgetCents : childBudgetsCents
}

export type SpendProgress = {
  /** paid ÷ budget, or null when the budget is zero. */
  ratio: number | null
  /** 0–100, for drawing a progress bar. Full when over budget. */
  barPercent: number
  /** Paid strictly exceeds budget. */
  overBudget: boolean
  /** budget − paid; negative when over budget. */
  remainingCents: number
}

export function spendProgress(budgetCents: number, paidCents: number): SpendProgress {
  const overBudget = paidCents > budgetCents
  const ratio = budgetCents > 0 ? paidCents / budgetCents : null
  const barPercent = overBudget ? 100 : ratio === null ? 0 : Math.min(100, ratio * 100)
  return { ratio, barPercent, overBudget, remainingCents: budgetCents - paidCents }
}

/** Budget, paid and progress for a category, event or the wedding. */
export type LevelSummary = {
  budgetCents: number
  paidCents: number
  /** Sum of the children's budgets: the auto budget, also useful context in manual mode. */
  childBudgetsCents: number
  progress: SpendProgress
}

export type ActivitySummary = {
  budgetCents: number
  actualCostCents: number | null
  paidCents: number
  paymentCount: number
  /** max(0, actual − paid); null when no actual cost has been entered. */
  outstandingCents: number | null
  /** Paid exceeds the activity budget. */
  overBudget: boolean
  /** Paid exceeds the actual cost. Only possible once an actual cost is known. */
  overpaid: boolean
  /** paid − actual when overpaid, otherwise 0. */
  overpaidByCents: number
  progress: SpendProgress
}

/** Activity figures from its budget, optional actual cost and active payment amounts. */
export function summarizeActivity(
  budgetCents: number,
  actualCostCents: number | null,
  paymentAmountsCents: number[],
): ActivitySummary {
  const paidCents = sumCents(paymentAmountsCents)
  const known = actualCostCents !== null
  const overpaid = known && paidCents > actualCostCents
  return {
    budgetCents,
    actualCostCents,
    paidCents,
    paymentCount: paymentAmountsCents.length,
    outstandingCents: known ? Math.max(0, actualCostCents - paidCents) : null,
    overBudget: paidCents > budgetCents,
    overpaid,
    overpaidByCents: overpaid ? paidCents - actualCostCents : 0,
    progress: spendProgress(budgetCents, paidCents),
  }
}

function summarizeLevel(
  mode: BudgetMode,
  manualBudgetCents: number,
  childBudgetsCents: number,
  paidCents: number,
): LevelSummary {
  const budgetCents = effectiveBudget(mode, manualBudgetCents, childBudgetsCents)
  return {
    budgetCents,
    paidCents,
    childBudgetsCents,
    progress: spendProgress(budgetCents, paidCents),
  }
}

/** Budget and paid for one shared category, summed across every event that uses it. */
export type CategoryDefinitionSummary = {
  categoryDefinitionId: Id
  budgetCents: number
  paidCents: number
  /** Number of active events using this category. */
  eventCount: number
}

export type BudgetIndex = {
  mode: BudgetMode
  wedding: LevelSummary
  /** Keyed by event id. Active events only. */
  events: Map<Id, LevelSummary>
  /** Keyed by event category id. Active categories only. */
  categories: Map<Id, LevelSummary>
  /** Keyed by activity id. Active activities only. */
  activities: Map<Id, ActivitySummary>
  /** Keyed by category definition id. Only definitions used by an active event. */
  categoryDefinitions: Map<Id, CategoryDefinitionSummary>
}

function addTo(map: Map<Id, number>, key: Id, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

/** Computes every summary for a wedding in a single pass over its active records. */
export function computeBudgetIndex(snapshot: WeddingSnapshot): BudgetIndex {
  const active = selectActive(snapshot)
  const mode = snapshot.wedding.budgetMode

  const paymentsByActivity = new Map<Id, number[]>()
  for (const p of active.payments) {
    const list = paymentsByActivity.get(p.activityId)
    if (list) list.push(p.amountCents)
    else paymentsByActivity.set(p.activityId, [p.amountCents])
  }

  const activities = new Map<Id, ActivitySummary>()
  const categoryChildBudgets = new Map<Id, number>()
  const categoryPaid = new Map<Id, number>()
  for (const a of active.activities) {
    const summary = summarizeActivity(
      a.budgetCents,
      a.actualCostCents,
      paymentsByActivity.get(a.id) ?? [],
    )
    activities.set(a.id, summary)
    addTo(categoryChildBudgets, a.eventCategoryId, summary.budgetCents)
    addTo(categoryPaid, a.eventCategoryId, summary.paidCents)
  }

  const categories = new Map<Id, LevelSummary>()
  const eventChildBudgets = new Map<Id, number>()
  const eventPaid = new Map<Id, number>()
  const definitionTotals = new Map<Id, CategoryDefinitionSummary>()
  for (const c of active.eventCategories) {
    const summary = summarizeLevel(
      mode,
      c.manualBudgetCents,
      categoryChildBudgets.get(c.id) ?? 0,
      categoryPaid.get(c.id) ?? 0,
    )
    categories.set(c.id, summary)
    addTo(eventChildBudgets, c.eventId, summary.budgetCents)
    addTo(eventPaid, c.eventId, summary.paidCents)

    const totals = definitionTotals.get(c.categoryDefinitionId) ?? {
      categoryDefinitionId: c.categoryDefinitionId,
      budgetCents: 0,
      paidCents: 0,
      eventCount: 0,
    }
    totals.budgetCents += summary.budgetCents
    totals.paidCents += summary.paidCents
    totals.eventCount += 1
    definitionTotals.set(c.categoryDefinitionId, totals)
  }

  const events = new Map<Id, LevelSummary>()
  let weddingChildBudgets = 0
  let weddingPaid = 0
  for (const e of active.events) {
    const summary = summarizeLevel(
      mode,
      e.manualBudgetCents,
      eventChildBudgets.get(e.id) ?? 0,
      eventPaid.get(e.id) ?? 0,
    )
    events.set(e.id, summary)
    weddingChildBudgets += summary.budgetCents
    weddingPaid += summary.paidCents
  }

  return {
    mode,
    wedding: summarizeLevel(
      mode,
      snapshot.wedding.manualBudgetCents,
      weddingChildBudgets,
      weddingPaid,
    ),
    events,
    categories,
    activities,
    categoryDefinitions: definitionTotals,
  }
}

/** The manual amounts to save when switching the wedding from auto to manual. */
export type ManualBudgetSeed = {
  weddingCents: number
  /** Keyed by event id. Active events only. */
  events: Map<Id, number>
  /** Keyed by event category id. Active categories only. */
  categories: Map<Id, number>
}

/**
 * Switching from auto to manual starts every level at its current calculated
 * total, so no budget jumps when the mode changes. Computed as if the wedding
 * were in auto mode, whatever its current mode.
 */
export function manualBudgetsFromCalculated(snapshot: WeddingSnapshot): ManualBudgetSeed {
  const index = computeBudgetIndex({
    ...snapshot,
    wedding: { ...snapshot.wedding, budgetMode: 'auto' },
  })
  const budgets = (map: Map<Id, LevelSummary>) =>
    new Map([...map].map(([id, s]) => [id, s.budgetCents]))
  return {
    weddingCents: index.wedding.budgetCents,
    events: budgets(index.events),
    categories: budgets(index.categories),
  }
}
