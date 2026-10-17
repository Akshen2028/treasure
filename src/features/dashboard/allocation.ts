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
  /**
   * Palette slot, fixed by budget rank so an item keeps its colour when the chart switches
   * between Budget and Paid. null for "Other", which is drawn in a neutral colour.
   */
  colorIndex: number | null
  /** Rows folded into "Other". */
  folded?: number
}

export type Allocation = { rows: AllocationRow[]; totalCents: number }

/** Distinct slice colours available (see --slice-* in index.css). */
export const PALETTE_SIZE = 7
/** At most this many slices on the card (7 colours + "Other"), so colours stay distinguishable. */
export const MAX_ROWS = PALETTE_SIZE + 1

type Item = { id: string; name: string; budgetCents: number; paidCents: number }

export function buildAllocation(items: Item[], measure: Measure, maxRows = MAX_ROWS): Allocation {
  const value = (i: Item) => (measure === 'budget' ? i.budgetCents : i.paidCents)
  const totalCents = items.reduce((sum, i) => sum + value(i), 0)
  const share = (cents: number) => (totalCents > 0 ? cents / totalCents : null)

  // Identity (colour, and which items fold into "Other") comes from budget rank, so toggling
  // between Budget and Paid never repaints or regroups anything.
  const byBudget = [...items].sort(
    (a, b) => b.budgetCents - a.budgetCents || a.name.localeCompare(b.name, 'en-CA'),
  )
  const fold = byBudget.length > maxRows
  const kept = fold ? byBudget.slice(0, maxRows - 1) : byBudget
  const folded = fold ? byBudget.slice(maxRows - 1) : []

  const rows: AllocationRow[] = kept.map((i, rank) => ({
    id: i.id,
    name: i.name,
    valueCents: value(i),
    share: share(value(i)),
    overBudget: i.paidCents > i.budgetCents,
    // Beyond the palette (only possible when not folding), items share the neutral colour.
    colorIndex: rank < PALETTE_SIZE ? rank : null,
  }))
  if (folded.length > 0) {
    const otherValue = folded.reduce((sum, i) => sum + value(i), 0)
    rows.push({
      id: 'other',
      name: `Other (${folded.length})`,
      valueCents: otherValue,
      share: share(otherValue),
      overBudget: false,
      colorIndex: null,
      folded: folded.length,
    })
  }

  // Display order follows the measure being shown, largest first; "Other" always last.
  rows.sort((a, b) => {
    if (a.folded) return 1
    if (b.folded) return -1
    return b.valueCents - a.valueCents || a.name.localeCompare(b.name, 'en-CA')
  })
  return { rows, totalCents }
}

/** Every item on its own, nothing folded: for the full breakdown view. */
export const UNGROUPED = Number.POSITIVE_INFINITY

export function eventAllocation(
  active: ActiveSnapshot,
  budget: BudgetIndex,
  measure: Measure,
  maxRows = MAX_ROWS,
): Allocation {
  const items = active.events.flatMap((e) => {
    const s = budget.events.get(e.id)
    return s ? [{ id: e.id, name: e.name, budgetCents: s.budgetCents, paidCents: s.paidCents }] : []
  })
  return buildAllocation(items, measure, maxRows)
}

/** Shared categories, each summed across every event that uses it. */
export function categoryAllocation(
  active: ActiveSnapshot,
  budget: BudgetIndex,
  measure: Measure,
  maxRows = MAX_ROWS,
): Allocation {
  const names = new Map(active.categoryDefinitions.map((d) => [d.id, d.name]))
  const items = [...budget.categoryDefinitions.values()].map((s) => ({
    id: s.categoryDefinitionId,
    name: names.get(s.categoryDefinitionId) ?? 'Category',
    budgetCents: s.budgetCents,
    paidCents: s.paidCents,
  }))
  return buildAllocation(items, measure, maxRows)
}
