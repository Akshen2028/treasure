/**
 * Data for the charts the assistant shows. Claude only describes the chart (rows, figures,
 * filters); every number here comes from the live snapshot and the app's own budget logic,
 * so a chart can't show a figure the app wouldn't. Pure, so it can be tested without
 * rendering.
 *
 * How it works: every record in scope becomes a "fact" (an activity with its budget, paid,
 * actual cost and still-to-pay; or a payment with its month), facts are filtered, then summed
 * into rows (groupBy) and, optionally, parts of each row (splitBy).
 *
 * Budgets follow the budget mode. When rows are events, categories or the whole wedding and
 * no activity-level filter applies, a row's budget is the level's own budget (so manual
 * budgets show as entered). Otherwise it is the sum of the activities' budgets.
 */
import type { WeddingData } from '@/data/queries'
import type {
  ChartDimension,
  ChartForm,
  ChartMeasure,
  ChartSpec,
  ChartSplit,
} from '@/domain/chatTools'
import { formatDate } from '@/domain/dates'
import { sortEvents } from '@/domain/ordering'
import { ACTIVITY_STATUSES, type ActivityStatus, type Id } from '@/domain/types'
import { STATUS_LABELS } from '@/features/activities/activityForm'
import { sortDefinitions } from '@/features/categories/categoryLogic'

import type { RefTarget } from './chatRefs'

export const MEASURE_LABELS: Record<ChartMeasure, string> = {
  budget: 'Budget',
  paid: 'Paid',
  actual: 'Actual cost',
  stillToPay: 'Still to pay',
  remaining: 'Left in budget',
  overBy: 'Over budget by',
  count: 'Activities',
}

/** Distinct colours for parts of a split (see --slice-* in index.css); the rest are "Other". */
export const SERIES_PALETTE = 7
/** Rows drawn before the rest are counted instead (bars and progress stay readable). */
export const DEFAULT_ROW_CAP = 12

export type ChartSeries = { id: string; name: string; colorIndex: number | null }

export type ChartRow = {
  id: string
  name: string
  /** One value per measure, in the order of `measures`. */
  values: number[]
  /** With splitBy: the first measure for each series, in the order of `series`. */
  parts: number[]
  budgetCents: number
  paidCents: number
  /** Paid exceeds budget (shown with an icon, never by colour alone). */
  overBudget: boolean
}

export type ChatChartData =
  | {
      kind: 'chart'
      form: ChartForm
      title: string
      measures: ChartMeasure[]
      /** Labels per measure (count reads "Payments" per month). */
      labels: string[]
      /** Which measures are counts rather than money. */
      isCount: boolean[]
      rows: ChartRow[]
      series: ChartSeries[]
      /** Rows left out by `top` or the row cap. */
      hidden: number
      notes: string[]
    }
  | { kind: 'missing'; title: string; message: string }

type Fact = {
  eventId: Id | null
  categoryId: Id | null
  definitionId: Id | null
  activityId: Id | null
  status: ActivityStatus | null
  month: string | null
  budget: number
  paid: number
  actual: number
  stillToPay: number
  count: number
}

type Totals = Pick<Fact, 'budget' | 'paid' | 'actual' | 'stillToPay' | 'count'>
const zero = (): Totals => ({ budget: 0, paid: 0, actual: 0, stillToPay: 0, count: 0 })
function add(into: Totals, fact: Totals) {
  into.budget += fact.budget
  into.paid += fact.paid
  into.actual += fact.actual
  into.stillToPay += fact.stillToPay
  into.count += fact.count
}

function measureValue(totals: Totals, measure: ChartMeasure): number {
  switch (measure) {
    case 'remaining':
      return Math.max(0, totals.budget - totals.paid)
    case 'overBy':
      return Math.max(0, totals.paid - totals.budget)
    default:
      return totals[measure]
  }
}

/** "2026-06" → "Jun 2026" */
const monthLabel = (month: string) => formatDate(`${month}-01`).replace(/ \d+,/, '')

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function buildChatChart(
  spec: ChartSpec,
  data: WeddingData,
  targets: Map<string, RefTarget>,
): ChatChartData {
  const { active, budget } = data
  const { title, groupBy, splitBy, measures } = spec
  const missing = (message: string): ChatChartData => ({ kind: 'missing', title, message })
  const byMonth = groupBy === 'month'
  /** Per month, or limited to a month range: the chart is made of payments, not activities. */
  const byPayments = byMonth || Boolean(spec.from || spec.to)
  /** Outside month rows, the range filters payments directly. */
  const inRange = (month: string) =>
    byMonth || ((!spec.from || month >= spec.from) && (!spec.to || month <= spec.to))

  // Look up records.
  const events = new Map(active.events.map((e) => [e.id, e]))
  const categories = new Map(active.eventCategories.map((c) => [c.id, c]))
  const definitions = new Map(active.categoryDefinitions.map((d) => [d.id, d]))
  const activities = new Map(active.activities.map((a) => [a.id, a]))
  const eventOrder = new Map(sortEvents(active.events).map((e, i) => [e.id, i]))
  const definitionOrder = new Map(
    sortDefinitions(active.categoryDefinitions).map((d, i) => [d.id, i]),
  )

  // Resolve references; anything deleted since the question means the chart is stale.
  const resolve = (ref: string) => {
    const target = targets.get(ref)
    const exists =
      target &&
      (target.kind === 'event'
        ? events.has(target.id)
        : target.kind === 'category'
          ? categories.has(target.id)
          : target.kind === 'definition'
            ? definitions.has(target.id)
            : activities.has(target.id))
    return exists ? target : null
  }
  const scope = spec.scope ? resolve(spec.scope) : null
  if (spec.scope && !scope) return missing('What this chart was about no longer exists.')
  const items = spec.items.map(resolve).filter((t): t is RefTarget => t !== null)
  if (spec.items.length && !items.length) return missing('Those records no longer exist.')

  // One event in view: categories are that event's own; otherwise shared categories.
  const singleEvent = scope?.kind === 'event' || scope?.kind === 'category'
  const statuses = new Set(spec.statuses)
  const activityLevel =
    groupBy === 'activity' ||
    groupBy === 'status' ||
    splitBy === 'activity' ||
    splitBy === 'status' ||
    statuses.size > 0 ||
    items.some((t) => t.kind === 'activity')
  const dims = new Set<ChartDimension | ChartSplit>([groupBy, ...(splitBy ? [splitBy] : [])])
  const budgetSource = activityLevel
    ? 'activity'
    : [...dims].every((d) => d === 'none') && !scope && !items.length
      ? 'wedding'
      : [...dims].every((d) => d === 'none' || d === 'event') &&
          scope?.kind !== 'category' &&
          scope?.kind !== 'definition' &&
          !items.some((t) => t.kind === 'category' || t.kind === 'definition')
        ? 'event'
        : 'category'

  const inScope = (f: Pick<Fact, 'eventId' | 'categoryId' | 'definitionId' | 'activityId'>) => {
    if (scope) {
      const key = { event: f.eventId, category: f.categoryId, definition: f.definitionId }
      if (key[scope.kind as keyof typeof key] !== scope.id) return false
    }
    if (items.length) {
      return items.some(
        (t) =>
          ({
            event: f.eventId,
            category: f.categoryId,
            definition: f.definitionId,
            activity: f.activityId,
          })[t.kind as 'event' | 'category' | 'definition' | 'activity'] === t.id,
      )
    }
    return true
  }

  // Facts.
  const facts: Fact[] = []
  const blank = { activityId: null, status: null, month: null, ...zero() }
  for (const activity of active.activities) {
    const category = categories.get(activity.eventCategoryId)
    if (!category) continue
    const base = {
      eventId: category.eventId,
      categoryId: category.id,
      definitionId: category.categoryDefinitionId,
      activityId: activity.id,
    }
    if (!inScope(base)) continue
    if (statuses.size && !statuses.has(activity.status)) continue
    if (byPayments) continue
    const summary = budget.activities.get(activity.id)
    if (!summary) continue
    facts.push({
      ...base,
      status: activity.status,
      month: null,
      budget: budgetSource === 'activity' ? summary.budgetCents : 0,
      paid: summary.paidCents,
      actual: summary.actualCostCents ?? 0,
      stillToPay: summary.outstandingCents ?? 0,
      count: 1,
    })
  }
  if (byPayments) {
    for (const payment of active.payments) {
      if (!inRange(payment.paidOn.slice(0, 7))) continue
      const activity = activities.get(payment.activityId)
      const category = activity && categories.get(activity.eventCategoryId)
      if (!activity || !category) continue
      const base = {
        eventId: category.eventId,
        categoryId: category.id,
        definitionId: category.categoryDefinitionId,
        activityId: activity.id,
      }
      if (!inScope(base)) continue
      if (statuses.size && !statuses.has(activity.status)) continue
      facts.push({
        ...base,
        ...zero(),
        status: activity.status,
        month: payment.paidOn.slice(0, 7),
        paid: payment.amountCents,
        count: 1,
      })
    }
  } else if (budgetSource === 'wedding') {
    facts.push({
      ...blank,
      eventId: null,
      categoryId: null,
      definitionId: null,
      budget: budget.wedding.budgetCents,
    })
  } else if (budgetSource === 'event') {
    for (const event of active.events) {
      const base = { eventId: event.id, categoryId: null, definitionId: null, activityId: null }
      if (!inScope(base)) continue
      facts.push({ ...blank, ...base, budget: budget.events.get(event.id)?.budgetCents ?? 0 })
    }
  } else if (budgetSource === 'category') {
    for (const category of active.eventCategories) {
      const base = {
        eventId: category.eventId,
        categoryId: category.id,
        definitionId: category.categoryDefinitionId,
        activityId: null,
      }
      if (!inScope(base)) continue
      facts.push({
        ...blank,
        ...base,
        budget: budget.categories.get(category.id)?.budgetCents ?? 0,
      })
    }
  }

  // Row and series keys.
  type Key = { id: string; name: string; order: number }
  function keyOf(fact: Fact, dim: ChartDimension | ChartSplit): Key | null {
    switch (dim) {
      case 'none':
        return { id: 'all', name: scopeName() ?? 'Whole wedding', order: 0 }
      case 'event': {
        const event = fact.eventId ? events.get(fact.eventId) : undefined
        return event
          ? { id: event.id, name: event.name, order: eventOrder.get(event.id) ?? 0 }
          : null
      }
      case 'category': {
        const definition = fact.definitionId ? definitions.get(fact.definitionId) : undefined
        if (!definition) return null
        const id = singleEvent && fact.categoryId ? fact.categoryId : definition.id
        return { id, name: definition.name, order: definitionOrder.get(definition.id) ?? 0 }
      }
      case 'activity': {
        const activity = fact.activityId ? activities.get(fact.activityId) : undefined
        return activity ? { id: activity.id, name: activity.name, order: 0 } : null
      }
      case 'status':
        return fact.status
          ? {
              id: fact.status,
              name: STATUS_LABELS[fact.status],
              order: ACTIVITY_STATUSES.indexOf(fact.status),
            }
          : null
      case 'month':
        return fact.month ? { id: fact.month, name: monthLabel(fact.month), order: 0 } : null
    }
  }
  function scopeName() {
    if (!scope) return null
    if (scope.kind === 'event') return events.get(scope.id)?.name ?? null
    if (scope.kind === 'definition') return definitions.get(scope.id)?.name ?? null
    const category = categories.get(scope.id)
    return category ? (definitions.get(category.categoryDefinitionId)?.name ?? null) : null
  }

  // Sum facts into rows and parts.
  type Group = Key & { totals: Totals; parts: Map<string, Totals> }
  const groups = new Map<string, Group>()
  const seriesKeys = new Map<string, Key>()
  for (const fact of facts) {
    const key = keyOf(fact, groupBy)
    if (!key) continue
    let group = groups.get(key.id)
    if (!group) groups.set(key.id, (group = { ...key, totals: zero(), parts: new Map() }))
    add(group.totals, fact)
    if (splitBy) {
      const part = keyOf(fact, splitBy)
      if (!part) continue
      let totals = group.parts.get(part.id)
      if (!totals) group.parts.set(part.id, (totals = zero()))
      add(totals, fact)
      if (!seriesKeys.has(part.id)) seriesKeys.set(part.id, part)
    }
  }

  // Activity names can repeat across events; add the event to tell them apart.
  if (groupBy === 'activity' || splitBy === 'activity') {
    const named = [...groups.values(), ...seriesKeys.values()]
    const counts = new Map<string, number>()
    for (const id of new Set(named.map((n) => n.id))) {
      const name = named.find((n) => n.id === id)!.name
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    for (const g of named) {
      const activity = activities.get(g.id)
      const category = activity && categories.get(activity.eventCategoryId)
      if (activity && category && (counts.get(g.name) ?? 0) > 1) {
        g.name = `${g.name} (${events.get(category.eventId)?.name ?? 'event'})`
      }
    }
  }

  // Months: fill gaps so time reads evenly, then running totals and the range.
  let ordered = [...groups.values()]
  if (byMonth && ordered.length) {
    ordered.sort((a, b) => a.id.localeCompare(b.id))
    const filled: Group[] = []
    let month = ordered[0]!.id
    const last = ordered.at(-1)!.id
    for (let guard = 0; month <= last && guard < 240; guard++, month = nextMonth(month)) {
      filled.push(
        groups.get(month) ?? {
          id: month,
          name: monthLabel(month),
          order: 0,
          totals: zero(),
          parts: new Map(),
        },
      )
    }
    ordered = filled
    if (spec.cumulative) {
      const running = zero()
      const runningParts = new Map<string, Totals>()
      ordered = ordered.map((g) => {
        add(running, g.totals)
        for (const [id, t] of g.parts) {
          const r = runningParts.get(id) ?? zero()
          add(r, t)
          runningParts.set(id, r)
        }
        const parts = new Map([...runningParts].map(([id, t]) => [id, { ...t }]))
        return { ...g, totals: { ...running }, parts }
      })
    }
    ordered = ordered.filter(
      (g) => (!spec.from || g.id >= spec.from) && (!spec.to || g.id <= spec.to),
    )
  }

  // Row filter, then order.
  ordered = ordered.filter((g) => {
    const t = g.totals
    if (spec.only === 'overBudget') return t.paid > t.budget
    if (spec.only === 'stillToPay') return t.stillToPay > 0
    if (spec.only === 'unpaid') return t.paid === 0
    return true
  })
  if (!byMonth) {
    const value = (g: Group) => measureValue(g.totals, measures[0]!)
    ordered.sort((a, b) =>
      spec.sort === 'name'
        ? a.name.localeCompare(b.name, 'en-CA')
        : spec.sort === 'value' || groupBy === 'activity'
          ? value(b) - value(a) || a.name.localeCompare(b.name, 'en-CA')
          : a.order - b.order || a.name.localeCompare(b.name, 'en-CA'),
    )
  }

  // Donuts fold their own tail into "Other"; other forms cap the rows they draw.
  const cap = spec.top ?? (spec.form === 'donut' || byMonth ? Infinity : DEFAULT_ROW_CAP)
  const kept = ordered.slice(0, cap)
  const hidden = ordered.length - kept.length

  // Series: only parts with something in the rows shown (a month range or filter can leave
  // others at zero), largest first, the palette's worth, then one neutral "Other".
  const seriesTotals = new Map<string, number>()
  for (const g of kept) {
    for (const [id, totals] of g.parts) {
      seriesTotals.set(id, (seriesTotals.get(id) ?? 0) + measureValue(totals, measures[0]!))
    }
  }
  const total = (id: string) => seriesTotals.get(id) ?? 0
  const rankedSeries = [...seriesKeys.values()]
    .filter((s) => total(s.id) > 0)
    .sort(
      (a, b) =>
        total(b.id) - total(a.id) || a.order - b.order || a.name.localeCompare(b.name, 'en-CA'),
    )
  const shownSeries =
    rankedSeries.length > SERIES_PALETTE + 1 ? rankedSeries.slice(0, SERIES_PALETTE) : rankedSeries
  const otherSeries = rankedSeries.slice(shownSeries.length)
  const series: ChartSeries[] = [
    ...shownSeries.map((s, i) => ({
      id: s.id,
      name: s.name,
      colorIndex: i < SERIES_PALETTE ? i : null,
    })),
    ...(otherSeries.length
      ? [{ id: 'other', name: `Other (${otherSeries.length})`, colorIndex: null }]
      : []),
  ]

  const rows: ChartRow[] = kept.map((g) => ({
    id: g.id,
    name: g.name,
    values: measures.map((m) => measureValue(g.totals, m)),
    parts: series.map((s) =>
      s.id === 'other'
        ? otherSeries.reduce(
            (sum, o) => sum + measureValue(g.parts.get(o.id) ?? zero(), measures[0]!),
            0,
          )
        : measureValue(g.parts.get(s.id) ?? zero(), measures[0]!),
    ),
    budgetCents: g.totals.budget,
    paidCents: g.totals.paid,
    overBudget: !byPayments && g.totals.paid > g.totals.budget,
  }))

  if (!rows.length || rows.every((r) => r.values.every((v) => v === 0))) {
    return missing(
      byMonth
        ? 'No payments recorded here yet.'
        : byPayments
          ? 'No payments in that period.'
          : spec.only
            ? 'Nothing matches that filter.'
            : 'Nothing to show here yet.',
    )
  }

  const notes: string[] = []
  if (measures.includes('actual') || measures.includes('stillToPay')) {
    notes.push('Actual cost and still to pay count only activities whose actual cost is known.')
  }
  if (spec.cumulative) notes.push('Running totals: each month includes everything paid before it.')

  return {
    kind: 'chart',
    form: spec.form,
    title,
    measures,
    labels: measures.map((m) => (m === 'count' && byPayments ? 'Payments' : MEASURE_LABELS[m])),
    isCount: measures.map((m) => m === 'count'),
    rows,
    series,
    hidden,
    notes,
  }
}
