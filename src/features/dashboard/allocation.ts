/**
 * Data for the dashboard allocation charts: how the budget (or what's been paid) splits
 * across events and across shared categories. Pure, so it can be tested without rendering.
 */
import type { BudgetIndex } from '@/domain/budget'
import type { ActiveSnapshot } from '@/domain/hierarchy'

export type Measure = 'budget' | 'paid'

export type AllocationRow = {
  id: string
  name: string
  valueCents: number
  /** Share of the chart's total, 0–1; null when the total is zero. */
  share: number | null
  /** Paid exceeds budget for this item (shown with an icon, never by colour alone). */
  overBudget: boolean
  /** Rows folded into "Other". */
  folded?: number
}

export type Allocation = { rows: AllocationRow[]; totalCents: number }

/** Beyond this many rows the tail folds into "Other", so bars stay readable. */
export const MAX_ROWS = 8

type Item = { id: string; name: string; budgetCents: number; paidCents: number }

export function buildAllocation(items: Item[], measure: Measure, maxRows = MAX_ROWS): Allocation {
  const value = (i: Item) => (measure === 'budget' ? i.budgetCents : i.paidCents)
  const totalCents = items.reduce((sum, i) => sum + value(i), 0)
  const sorted = [...items].sort(
    (a, b) => value(b) - value(a) || a.name.localeCompare(b.name, 'en-CA'),
  )
  const toRow = (i: Item): AllocationRow => ({
    id: i.id,
    name: i.name,
    valueCents: value(i),
    share: totalCents > 0 ? value(i) / totalCents : null,
    overBudget: i.paidCents > i.budgetCents,
  })

  if (sorted.length <= maxRows) return { rows: sorted.map(toRow), totalCents }

  const head = sorted.slice(0, maxRows - 1).map(toRow)
  const tail = sorted.slice(maxRows - 1)
  const other = tail.reduce(
    (acc, i) => ({ budget: acc.budget + i.budgetCents, paid: acc.paid + i.paidCents }),
    { budget: 0, paid: 0 },
  )
  const otherValue = measure === 'budget' ? other.budget : other.paid
  return {
    rows: [
      ...head,
      {
        id: 'other',
        name: `Other (${tail.length})`,
        valueCents: otherValue,
        share: totalCents > 0 ? otherValue / totalCents : null,
        overBudget: false,
        folded: tail.length,
      },
    ],
    totalCents,
  }
}

export function eventAllocation(
  active: ActiveSnapshot,
  budget: BudgetIndex,
  measure: Measure,
): Allocation {
  const items = active.events.flatMap((e) => {
    const s = budget.events.get(e.id)
    return s ? [{ id: e.id, name: e.name, budgetCents: s.budgetCents, paidCents: s.paidCents }] : []
  })
  return buildAllocation(items, measure)
}

/** Shared categories, each summed across every event that uses it. */
export function categoryAllocation(
  active: ActiveSnapshot,
  budget: BudgetIndex,
  measure: Measure,
): Allocation {
  const names = new Map(active.categoryDefinitions.map((d) => [d.id, d.name]))
  const items = [...budget.categoryDefinitions.values()].map((s) => ({
    id: s.categoryDefinitionId,
    name: names.get(s.categoryDefinitionId) ?? 'Category',
    budgetCents: s.budgetCents,
    paidCents: s.paidCents,
  }))
  return buildAllocation(items, measure)
}
