/**
 * The assistant's tools: showing a chart and proposing edits. Shared by the browser and the
 * `chat` Edge Function, so it may only import other import-free domain files, with `.ts`
 * extensions (Deno resolves imports literally).
 *
 * Claude never sees database ids. Each request carries short references (E1, C3, A12…) built
 * in the browser from the records it shows; the browser maps them back to ids. Everything
 * Claude sends is validated here: the function rejects malformed calls so Claude can retry,
 * and the browser checks them again before showing anything.
 */
import { parseCadInput } from './money.ts'
import type { ActivityStatus, BudgetMode } from './types.ts'

const STATUSES: readonly ActivityStatus[] = ['idea', 'planned', 'booked', 'completed']
const MODES: readonly BudgetMode[] = ['auto', 'manual']

// ---------------------------------------------------------------------------------------------
// References

export const REF_KINDS = ['definition', 'event', 'category', 'activity', 'payment', 'link'] as const
export type RefKind = (typeof REF_KINDS)[number]

export const REF_PREFIX = {
  definition: 'D',
  event: 'E',
  category: 'C',
  activity: 'A',
  payment: 'P',
  link: 'L',
} as const satisfies Record<RefKind, string>

/** One record Claude may point at. Listed parents first, so the order is the outline. */
export type ChatRef = { ref: string; kind: RefKind; name: string }

export const REF_LIMITS = { count: 5_000, nameChars: 300 } as const

/** References to records created earlier in the same proposal, e.g. "N1". */
const NEW_REF = /^N\d{1,3}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks the untrusted reference list from a chat request. */
export function validateRefs(value: unknown): { ok: true; value: ChatRef[] } | { ok: false } {
  if (value === undefined) return { ok: true, value: [] }
  if (!Array.isArray(value) || value.length > REF_LIMITS.count) return { ok: false }
  const seen = new Set<string>()
  const refs: ChatRef[] = []
  for (const item of value) {
    if (!isRecord(item)) return { ok: false }
    const { ref, kind, name } = item
    if (typeof kind !== 'string' || !(REF_KINDS as readonly string[]).includes(kind)) {
      return { ok: false }
    }
    const prefix = REF_PREFIX[kind as RefKind]
    if (typeof ref !== 'string' || !new RegExp(`^${prefix}\\d{1,5}$`).test(ref))
      return { ok: false }
    if (typeof name !== 'string' || name.length > REF_LIMITS.nameChars) return { ok: false }
    if (seen.has(ref)) return { ok: false }
    seen.add(ref)
    refs.push({ ref, kind: kind as RefKind, name })
  }
  return { ok: true, value: refs }
}

const DEPTH: Record<RefKind, number> = {
  definition: 0,
  event: 0,
  category: 1,
  activity: 2,
  payment: 3,
  link: 3,
}

/** The reference list as Claude reads it: shared categories, then the event tree. */
export function refsOutline(refs: ChatRef[], today: string | null): string {
  const definitions = refs.filter((r) => r.kind === 'definition')
  const tree = refs.filter((r) => r.kind !== 'definition')
  return [
    ...(today ? [`Today is ${today}.`, ''] : []),
    'Record references for tool calls. Use only these; never invent one.',
    '',
    'Shared categories:',
    ...(definitions.length ? definitions.map((r) => `${r.ref} ${r.name}`) : ['(none)']),
    '',
    'Events › categories › activities › payments and links:',
    ...(tree.length
      ? tree.map((r) => `${'  '.repeat(DEPTH[r.kind])}${r.ref} ${r.name}`)
      : ['(none)']),
  ].join('\n')
}

// ---------------------------------------------------------------------------------------------
// Parsing helpers: each throws Invalid with a message Claude can act on.

class Invalid extends Error {}

type Fields = Record<string, unknown>
type RefLookup = Map<string, RefKind>

function text(fields: Fields, key: string, max: number, required = false): string | undefined {
  const value = fields[key]
  if (value === undefined || value === null) {
    if (required) throw new Invalid(`"${key}" is required.`)
    return undefined
  }
  if (typeof value !== 'string') throw new Invalid(`"${key}" must be text.`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new Invalid(`"${key}" can't be empty.`)
  if (trimmed.length > max) throw new Invalid(`"${key}" must be at most ${max} characters.`)
  return trimmed
}

function nameField(fields: Fields, max: number, required = false) {
  const value = text(fields, 'name', max, required)
  if (value === '') throw new Invalid('"name" can\'t be empty.')
  return value
}

/** Dollar amounts arrive as text like "1250.00"; parsed to integer cents without floats. */
function money(
  fields: Fields,
  key: string,
  options: { required?: boolean; positive?: boolean } = {},
) {
  const value = fields[key]
  if (value === undefined || value === null) {
    if (options.required) throw new Invalid(`"${key}" is required.`)
    return undefined
  }
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  const cents = typeof raw === 'string' ? parseCadInput(raw) : null
  if (cents === null) throw new Invalid(`"${key}" must be a dollar amount like "1250.00".`)
  if (options.positive && cents === 0) throw new Invalid(`"${key}" must be more than $0.`)
  return cents
}

/** Like money, but the text "none" (or JSON null) clears the value. */
function optionalMoney(fields: Fields, key: string): number | null | undefined {
  const value = fields[key]
  if (value === undefined) return undefined
  if (value === null || (typeof value === 'string' && value.trim().toLowerCase() === 'none')) {
    return null
  }
  return money(fields, key)
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function dateField(
  fields: Fields,
  key: string,
  options: { required?: boolean; clearable?: boolean },
) {
  const value = fields[key]
  if (value === undefined || value === null) {
    if (options.required) throw new Invalid(`"${key}" is required.`)
    return undefined
  }
  if (options.clearable && value === 'none') return null
  if (typeof value !== 'string' || !isIsoDate(value)) {
    throw new Invalid(`"${key}" must be a date like 2026-06-14.`)
  }
  return value
}

function choice<T extends string>(fields: Fields, key: string, options: readonly T[]) {
  const value = fields[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value)) {
    throw new Invalid(`"${key}" must be one of: ${options.join(', ')}.`)
  }
  return value as T
}

function refField(
  fields: Fields,
  key: string,
  kinds: readonly RefKind[],
  refs: RefLookup,
  created?: RefLookup,
): string {
  const value = fields[key]
  if (typeof value !== 'string' || !value) throw new Invalid(`"${key}" is required.`)
  const kind = refs.get(value) ?? created?.get(value)
  if (!kind) throw new Invalid(`"${key}": ${value} isn't in the reference list.`)
  if (!kinds.includes(kind)) {
    throw new Invalid(`"${key}": ${value} is a ${kind}, expected a ${kinds.join(' or ')}.`)
  }
  return value
}

/** Copies only the keys that were given, so "not mentioned" and "cleared" stay distinct. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// ---------------------------------------------------------------------------------------------
// Charts

/**
 * donut: shares of one figure. bars: one to three figures side by side (or one figure split
 * into stacked parts). progress: paid against budget with over-budget flags. columns / line:
 * figures per month.
 */
export const CHART_FORMS = ['donut', 'bars', 'progress', 'columns', 'line'] as const
export type ChartForm = (typeof CHART_FORMS)[number]

/** What each row (slice, bar, column) is. "none" is a single row for everything in scope. */
export const CHART_DIMENSIONS = [
  'none',
  'event',
  'category',
  'activity',
  'status',
  'month',
] as const
export type ChartDimension = (typeof CHART_DIMENSIONS)[number]
/** What a row can be split into (stacked parts or separate lines). */
export const CHART_SPLITS = ['event', 'category', 'activity', 'status'] as const
export type ChartSplit = (typeof CHART_SPLITS)[number]

export const CHART_MEASURES = [
  'budget',
  'paid',
  'actual',
  'stillToPay',
  'remaining',
  'overBy',
  'count',
] as const
export type ChartMeasure = (typeof CHART_MEASURES)[number]
/** Per month there are only payments: how much, and how many. */
const MONTH_MEASURES: readonly ChartMeasure[] = ['paid', 'count']

export const CHART_ONLY = ['overBudget', 'stillToPay', 'unpaid'] as const
export type ChartOnly = (typeof CHART_ONLY)[number]

export const CHART_SORTS = ['value', 'name', 'natural'] as const
export type ChartSort = (typeof CHART_SORTS)[number]

export const CHART_LIMITS = { measures: 3, items: 30, top: 30 } as const

/**
 * What to draw. The numbers are never Claude's: the browser computes them from the current
 * data, with the same budget logic as the rest of the app.
 */
export type ChartSpec = {
  form: ChartForm
  title: string
  groupBy: ChartDimension
  splitBy: ChartSplit | null
  measures: ChartMeasure[]
  /** Everything inside one event (E…), event category (C…) or shared category (D…). */
  scope: string | null
  /** Only these records (E, C, D or A references); empty for all. */
  items: string[]
  /** Only activities with these statuses; empty for all. */
  statuses: ActivityStatus[]
  /** Only rows that are over budget, still have something to pay, or have nothing paid. */
  only: ChartOnly | null
  sort: ChartSort
  /** Keep the largest N rows after sorting. */
  top: number | null
  /** Running totals over months. */
  cumulative: boolean
  /** Month range, YYYY-MM, inclusive. */
  from: string | null
  to: string | null
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function list(fields: Fields, key: string, max: number): unknown[] {
  const value = fields[key]
  if (value === undefined || value === null) return []
  const items = Array.isArray(value) ? value : [value]
  if (items.length > max) throw new Invalid(`"${key}" can list at most ${max}.`)
  return items
}

function choices<T extends string>(
  fields: Fields,
  key: string,
  options: readonly T[],
  max: number,
) {
  const values = new Set(
    list(fields, key, max * 2).map((value) => {
      const picked = choice({ [key]: value }, key, options)
      if (!picked) throw new Invalid(`"${key}" must list values from: ${options.join(', ')}.`)
      return picked
    }),
  )
  if (values.size > max) throw new Invalid(`"${key}" can list at most ${max}.`)
  return [...values]
}

function monthField(fields: Fields, key: string) {
  const value = fields[key]
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Invalid(`"${key}" must be a month like 2026-06.`)
  }
  return value
}

export function parseChartSpec(input: unknown, refs: RefLookup): Parsed<ChartSpec> {
  try {
    if (!isRecord(input)) throw new Invalid('Expected an object.')
    // Left out, the form follows the data: a donut where it fits (it opens a full breakdown).
    const askedForm = choice(input, 'form', CHART_FORMS) ?? null
    let form = askedForm
    const title = text(input, 'title', 80, true)!
    const groupBy = choice(input, 'groupBy', CHART_DIMENSIONS)
    if (!groupBy) throw new Invalid(`"groupBy" is required: one of ${CHART_DIMENSIONS.join(', ')}.`)
    const byMonth = groupBy === 'month'

    // Months are drawn as columns or a line; everything else as donut, bars or progress.
    if (byMonth && form !== 'line') form = 'columns'
    if (!byMonth && (form === 'columns' || form === 'line')) {
      throw new Invalid(`"${form}" charts need groupBy "month"; use bars instead.`)
    }

    const splitBy = choice(input, 'splitBy', CHART_SPLITS) ?? null
    if (splitBy && splitBy === groupBy) throw new Invalid('"splitBy" must differ from "groupBy".')
    if (splitBy && (form === 'donut' || form === 'progress')) {
      throw new Invalid(`${form} charts can’t be split; use bars, columns or line.`)
    }

    // A month range turns any chart into "payments made in that period".
    const from = monthField(input, 'from')
    const to = monthField(input, 'to')
    if (from && to && from > to) throw new Invalid('"from" must be before "to".')
    const byPayments = byMonth || Boolean(from || to)
    if (byPayments && !byMonth && form === 'progress') {
      throw new Invalid('Progress compares against budgets, which have no dates; use bars.')
    }

    let measures = choices(input, 'measures', CHART_MEASURES, CHART_LIMITS.measures)
    if (form === 'progress') measures = ['budget', 'paid']
    if (!measures.length) measures = [byPayments ? 'paid' : 'budget']
    if (byPayments && measures.some((m) => !MONTH_MEASURES.includes(m))) {
      throw new Invalid(
        byMonth
          ? 'Per month only "paid" and "count" (payments) are available.'
          : 'With "from"/"to" only "paid" and "count" (payments in that period) are available.',
      )
    }
    if ((form === 'donut' || splitBy) && measures.length > 1) {
      throw new Invalid(`${splitBy ? 'Split' : 'Donut'} charts show one measure.`)
    }
    // Several figures or a split can't be a donut; columns compare them instead.
    const chosenForm: ChartForm = form ?? (splitBy || measures.length > 1 ? 'bars' : 'donut')

    const scope =
      input.scope === undefined || input.scope === null || input.scope === ''
        ? null
        : refField(input, 'scope', ['event', 'category', 'definition'], refs)
    const items = list(input, 'items', CHART_LIMITS.items).map((value) =>
      refField({ items: value }, 'items', ['event', 'category', 'definition', 'activity'], refs),
    )
    const statuses = choices(input, 'statuses', STATUSES, STATUSES.length)
    const only = choice(input, 'only', CHART_ONLY) ?? null
    if (only && byPayments) {
      throw new Invalid('"only" compares against budgets, which have no dates; drop it here.')
    }
    const sort =
      choice(input, 'sort', CHART_SORTS) ??
      (groupBy === 'category' || groupBy === 'activity' ? 'value' : 'natural')

    const topValue = input.top
    let top: number | null = null
    if (topValue !== undefined && topValue !== null) {
      if (
        typeof topValue !== 'number' ||
        !Number.isInteger(topValue) ||
        topValue < 1 ||
        topValue > CHART_LIMITS.top
      ) {
        throw new Invalid(`"top" must be a whole number from 1 to ${CHART_LIMITS.top}.`)
      }
      top = topValue
    }

    const cumulative = input.cumulative === true
    if (cumulative && !byMonth) throw new Invalid('"cumulative" only applies with groupBy "month".')

    return {
      ok: true,
      value: {
        form: chosenForm,
        title,
        groupBy,
        splitBy,
        measures,
        scope,
        items: [...new Set(items)],
        statuses,
        only,
        sort,
        top,
        cumulative,
        from,
        to,
      },
    }
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message }
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// Edits

type EventFields = {
  name?: string
  date?: string | null
  location?: string
  description?: string
  budgetCents?: number
}
type ActivityFields = {
  name?: string
  status?: ActivityStatus
  budgetCents?: number
  actualCostCents?: number | null
  description?: string
  notes?: string
}

/** One change, with amounts in cents. Refs are E/C/A/P/L/D, or N… for earlier creations. */
export type EditChange =
  | { op: 'update_wedding'; name?: string; date?: string | null; budgetCents?: number }
  | { op: 'set_budget_mode'; mode: BudgetMode }
  | ({ op: 'create_event'; as: string | null; name: string } & Omit<EventFields, 'name'>)
  | ({ op: 'update_event'; event: string } & EventFields)
  | {
      op: 'add_category'
      as: string | null
      event: string
      /** An existing shared category (D…), or null to create one called `name`. */
      definition: string | null
      name: string | null
      budgetCents?: number
    }
  | { op: 'update_category'; category: string; name?: string; budgetCents?: number }
  | ({ op: 'create_activity'; as: string | null; category: string; name: string } & Omit<
      ActivityFields,
      'name'
    >)
  | ({ op: 'update_activity'; activity: string } & ActivityFields)
  | { op: 'add_payment'; activity: string; amountCents: number; date: string; note?: string }
  | { op: 'update_payment'; payment: string; amountCents?: number; date?: string; note?: string }
  | { op: 'add_link'; activity: string; url: string; label?: string }
  | { op: 'update_link'; link: string; url?: string; label?: string }
  | { op: 'delete'; target: string }

export type EditOp = EditChange['op']

export const EDIT_OPS = [
  'update_wedding',
  'set_budget_mode',
  'create_event',
  'update_event',
  'add_category',
  'update_category',
  'create_activity',
  'update_activity',
  'add_payment',
  'update_payment',
  'add_link',
  'update_link',
  'delete',
] as const satisfies readonly EditOp[]

export type EditProposal = { summary: string; changes: EditChange[] }

export const EDIT_LIMITS = { changes: 30, summaryChars: 200 } as const

function url(fields: Fields, required: boolean) {
  const value = text(fields, 'url', 2048, required)
  if (value !== undefined && !/^https?:\/\/[^\s]+$/i.test(value)) {
    throw new Invalid('"url" must be a full web address starting with https://.')
  }
  return value
}

function eventFields(fields: Fields): EventFields {
  return defined({
    name: nameField(fields, 120),
    date: dateField(fields, 'date', { clearable: true }),
    location: text(fields, 'location', 200),
    description: text(fields, 'description', 5000),
    budgetCents: money(fields, 'budget'),
  })
}

function activityFields(fields: Fields): ActivityFields {
  return defined({
    name: nameField(fields, 200),
    status: choice(fields, 'status', STATUSES),
    budgetCents: money(fields, 'budget'),
    actualCostCents: optionalMoney(fields, 'actualCost'),
    description: text(fields, 'description', 5000),
    notes: text(fields, 'notes', 10000),
  })
}

function createdAs(fields: Fields, kind: RefKind, created: RefLookup, refs: RefLookup) {
  const value = fields.as
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !NEW_REF.test(value)) {
    throw new Invalid('"as" must look like N1, N2…')
  }
  if (created.has(value) || refs.has(value)) throw new Invalid(`"as": ${value} is already used.`)
  created.set(value, kind)
  return value
}

function requireSomething(change: object, op: string) {
  if (Object.keys(change).length <= 2)
    throw new Invalid(`${op} needs at least one field to change.`)
}

/** The fields each operation takes. Anything else is refused, so a misplaced value (say, a
 * budget sent as "amount") is corrected by Claude instead of silently dropped. */
const OP_FIELDS: Record<EditOp, readonly string[]> = {
  update_wedding: ['name', 'date', 'budget'],
  set_budget_mode: ['mode'],
  create_event: ['as', 'name', 'date', 'location', 'description', 'budget'],
  update_event: ['event', 'name', 'date', 'location', 'description', 'budget'],
  add_category: ['as', 'event', 'definition', 'name', 'budget'],
  update_category: ['category', 'name', 'budget'],
  create_activity: [
    'as',
    'category',
    'name',
    'status',
    'budget',
    'actualCost',
    'description',
    'notes',
  ],
  update_activity: ['activity', 'name', 'status', 'budget', 'actualCost', 'description', 'notes'],
  add_payment: ['activity', 'amount', 'date', 'note'],
  update_payment: ['payment', 'amount', 'date', 'note'],
  add_link: ['activity', 'url', 'label'],
  update_link: ['link', 'url', 'label'],
  delete: ['target'],
}

const CONTEXT_FIELDS: readonly string[] = [
  'as',
  'event',
  'category',
  'definition',
  'activity',
  'payment',
  'link',
  'target',
]

function parseChange(fields: Fields, refs: RefLookup, created: RefLookup): EditChange {
  const op = choice(fields, 'op', EDIT_OPS)
  if (!op) throw new Invalid(`"op" is required: one of ${EDIT_OPS.join(', ')}.`)
  for (const [key, value] of Object.entries(fields)) {
    // Empty fields are fine (the schema is shared by every operation), and so are extra
    // references given as context (e.g. the event of a category). Misplaced values are not.
    if (key === 'op' || value === undefined || value === null || value === '') continue
    if (CONTEXT_FIELDS.includes(key)) continue
    if (!OP_FIELDS[op].includes(key)) {
      throw new Invalid(`"${key}" doesn’t apply to ${op}; it takes: ${OP_FIELDS[op].join(', ')}.`)
    }
  }
  switch (op) {
    case 'update_wedding': {
      const change = defined({
        op,
        name: nameField(fields, 200),
        date: dateField(fields, 'date', { clearable: true }),
        budgetCents: money(fields, 'budget'),
      })
      if (Object.keys(change).length === 1) throw new Invalid(`${op} needs a field to change.`)
      return change
    }
    case 'set_budget_mode': {
      const mode = choice(fields, 'mode', MODES)
      if (!mode) throw new Invalid('"mode" is required: auto or manual.')
      return { op, mode }
    }
    case 'create_event': {
      const { name: eventName, ...rest } = eventFields(fields)
      if (!eventName) throw new Invalid('"name" is required.')
      return { op, as: createdAs(fields, 'event', created, refs), name: eventName, ...rest }
    }
    case 'update_event': {
      const change = {
        op,
        event: refField(fields, 'event', ['event'], refs),
        ...eventFields(fields),
      }
      requireSomething(change, op)
      return change
    }
    case 'add_category': {
      const event = refField(fields, 'event', ['event'], refs, created)
      const hasDefinition = fields.definition !== undefined && fields.definition !== null
      const definition = hasDefinition ? refField(fields, 'definition', ['definition'], refs) : null
      const categoryName = hasDefinition ? null : (nameField(fields, 60) ?? null)
      if (!definition && !categoryName) {
        throw new Invalid('add_category needs "definition" (D…) or a "name" for a new category.')
      }
      return defined({
        op,
        as: createdAs(fields, 'category', created, refs),
        event,
        definition,
        name: categoryName,
        budgetCents: money(fields, 'budget'),
      })
    }
    case 'update_category': {
      const change = defined({
        op,
        category: refField(fields, 'category', ['category'], refs),
        name: nameField(fields, 60),
        budgetCents: money(fields, 'budget'),
      })
      requireSomething(change, op)
      return change
    }
    case 'create_activity': {
      const category = refField(fields, 'category', ['category'], refs, created)
      const { name: activityName, ...rest } = activityFields(fields)
      if (!activityName) throw new Invalid('"name" is required.')
      return {
        op,
        as: createdAs(fields, 'activity', created, refs),
        category,
        name: activityName,
        ...rest,
      }
    }
    case 'update_activity': {
      const change = {
        op,
        activity: refField(fields, 'activity', ['activity'], refs),
        ...activityFields(fields),
      }
      requireSomething(change, op)
      return change
    }
    case 'add_payment':
      return defined({
        op,
        activity: refField(fields, 'activity', ['activity'], refs, created),
        amountCents: money(fields, 'amount', { required: true, positive: true })!,
        date: dateField(fields, 'date', { required: true })!,
        note: text(fields, 'note', 1000),
      })
    case 'update_payment': {
      const change = defined({
        op,
        payment: refField(fields, 'payment', ['payment'], refs),
        amountCents: money(fields, 'amount', { positive: true }),
        date: dateField(fields, 'date', {}) ?? undefined,
        note: text(fields, 'note', 1000),
      })
      requireSomething(change, op)
      return change
    }
    case 'add_link':
      return defined({
        op,
        activity: refField(fields, 'activity', ['activity'], refs, created),
        url: url(fields, true)!,
        label: text(fields, 'label', 200),
      })
    case 'update_link': {
      const change = defined({
        op,
        link: refField(fields, 'link', ['link'], refs),
        url: url(fields, false),
        label: text(fields, 'label', 200),
      })
      requireSomething(change, op)
      return change
    }
    case 'delete':
      return {
        op,
        target: refField(
          fields,
          'target',
          ['event', 'category', 'activity', 'payment', 'link'],
          refs,
        ),
      }
  }
}

export function parseEditProposal(input: unknown, refs: RefLookup): Parsed<EditProposal> {
  try {
    if (!isRecord(input)) throw new Invalid('Expected an object.')
    const summary = text(input, 'summary', EDIT_LIMITS.summaryChars, true)!
    const { changes } = input
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Invalid('"changes" must list at least one change.')
    }
    if (changes.length > EDIT_LIMITS.changes) {
      throw new Invalid(`At most ${EDIT_LIMITS.changes} changes per proposal; split it up.`)
    }
    const created: RefLookup = new Map()
    const parsed = changes.map((change, index) => {
      try {
        if (!isRecord(change)) throw new Invalid('Expected an object.')
        return parseChange(change, refs, created)
      } catch (error) {
        if (error instanceof Invalid) throw new Invalid(`Change ${index + 1}: ${error.message}`)
        throw error
      }
    })
    return { ok: true, value: { summary, changes: parsed } }
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message }
    throw error
  }
}

export const refLookup = (refs: ChatRef[]): RefLookup => new Map(refs.map((r) => [r.ref, r.kind]))

// ---------------------------------------------------------------------------------------------
// Tool definitions sent to Claude

type ToolDefinition = {
  name: string
  description: string
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] }
}

const refProp = (description: string) => ({ type: 'string', description })
const moneyProp = (description: string) => ({
  type: 'string',
  description: `${description} Dollars as text, e.g. "1250.00".`,
})

export const SHOW_CHART = 'show_chart'
export const PROPOSE_EDIT = 'propose_edit'

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    name: SHOW_CHART,
    description: [
      'Shows the planner a chart below your message. The app computes every number from the',
      'live budget, so you only describe what to show. Pick:',
      '- groupBy: what each row/slice/bar is: none (one total), event, category (shared',
      '  categories across the wedding, or the event’s categories when scoped to one event),',
      '  activity, status, or month (payments by the month they were paid).',
      '- measures (1–3): budget, paid, actual (known actual costs), stillToPay (actual − paid,',
      '  only where actual is known), remaining (budget − paid, never below 0), overBy (paid −',
      '  budget when over), count (activities; per month, payments). Per month only paid and',
      '  count exist.',
      '- form: leave it out unless the planner asks for a chart type. The default is a donut',
      '  for one figure (the planner can open its full breakdown), columns for several figures',
      '  or a split, and columns per month. Set it only on request: bars (columns), line (per',
      '  month; suits cumulative totals), progress (paid against budget, flags over budget; also',
      '  use it for "what is over budget"), or donut.',
      '- splitBy (optional, one measure): event, category, activity or status, as stacked parts',
      '  of each bar/column or one line each.',
      '- Filters: scope (one event E…, event category C…, or shared category D… across all',
      '  events), items (only these E/C/D/A records), statuses, only (overBudget, stillToPay,',
      '  unpaid), sort (value, name, natural), top (largest N), from/to (months, YYYY-MM),',
      '  cumulative (running totals per month).',
      '- from/to work with any groupBy: the chart then counts only payments made in that period',
      '  (measures paid or count). groupBy month shows a trend across several months; never use',
      '  it for a single month.',
      'Examples:',
      '- Food across events: groupBy event, scope the Food D…, measures [budget].',
      '- Food across events, budget vs paid: same with measures [budget, paid].',
      '- Each category split by event: groupBy category, splitBy event, measures [budget].',
      '- Payments over time per event: groupBy month, splitBy event, form line, cumulative true.',
      '- Money by status: groupBy status, measures [budget].',
      '- Top 5 costs: groupBy activity, measures [budget], top 5.',
      '- What was paid this month, by expense: groupBy activity, from and to = this month,',
      '  measures [paid].',
      '- What is over budget: groupBy activity, form progress, only overBudget.',
      '- Compare three vendors: groupBy activity, items [A…, A…, A…], measures budget, actual,',
      '  paid.',
      '- "As a bar chart": add form bars.',
      'If one chart can’t answer the question, you may show two.',
    ].join('\n'),
    input_schema: {
      type: 'object',
      properties: {
        form: {
          type: 'string',
          enum: [...CHART_FORMS],
          description: 'Only when the planner asks for a type; default donut where it fits.',
        },
        title: { type: 'string', description: 'Short heading, e.g. "Food across events".' },
        groupBy: { type: 'string', enum: [...CHART_DIMENSIONS] },
        splitBy: { type: 'string', enum: [...CHART_SPLITS] },
        measures: {
          type: 'array',
          items: { type: 'string', enum: [...CHART_MEASURES] },
          description: 'Default: budget (paid per month).',
        },
        scope: refProp('Optional E…, C… or D… reference.'),
        items: { type: 'array', items: refProp('E…, C…, D… or A… reference.') },
        statuses: { type: 'array', items: { type: 'string', enum: [...STATUSES] } },
        only: { type: 'string', enum: [...CHART_ONLY] },
        sort: { type: 'string', enum: [...CHART_SORTS] },
        top: { type: 'integer', minimum: 1, maximum: CHART_LIMITS.top },
        cumulative: { type: 'boolean' },
        from: { type: 'string', description: 'First month, YYYY-MM; any groupBy.' },
        to: { type: 'string', description: 'Last month, YYYY-MM; any groupBy.' },
      },
      required: ['title', 'groupBy'],
    },
  },
  {
    name: PROPOSE_EDIT,
    description: [
      'Proposes changes to the wedding. Nothing changes until the planner reviews the card and',
      'taps Apply, so never say the change is done. Put every change for one request into one',
      'call; they apply in order. Operations ("op") and the fields each uses:',
      '- update_wedding: name, date, budget (wedding budget; manual mode only)',
      '- set_budget_mode: mode (auto | manual)',
      '- create_event: name, date, location, description, budget (manual mode), as',
      '- update_event: event, name, date, location, description, budget (manual mode)',
      '- add_category: event, definition (an existing shared category D…) OR name (creates a new',
      '  shared category), budget (manual mode), as',
      '- update_category: category (C…), name (renames the shared category in every event),',
      '  budget (this event category; manual mode)',
      '- create_activity: category, name, status, budget, actualCost, description, notes, as',
      '- update_activity: activity, name, status, budget, actualCost, description, notes',
      '- add_payment: activity, amount, date, note',
      '- update_payment: payment, amount, date, note',
      '- add_link: activity, url, label',
      '- update_link: link, url, label',
      '- delete: target (an E, C, A, P or L reference; it moves to Recently Deleted)',
      'To use something created earlier in the same proposal, give it "as": "N1" and refer to',
      'N1 later (as the event, category or activity of a following change).',
      'Only include fields that change. Use "none" for date or actualCost to clear it.',
    ].join('\n'),
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description:
            'One short line describing the whole proposal, e.g. "Record the florist deposit".',
        },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: [...EDIT_OPS] },
              as: { type: 'string', description: 'Name for a new record, e.g. "N1".' },
              event: refProp('Event reference (E…, or N… from this proposal).'),
              category: refProp('Event category reference (C…, or N…).'),
              definition: refProp('Shared category reference (D…).'),
              activity: refProp('Activity reference (A…, or N…).'),
              payment: refProp('Payment reference (P…).'),
              link: refProp('Link reference (L…).'),
              target: refProp('What to delete (E, C, A, P or L reference).'),
              name: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD, or "none" to clear.' },
              location: { type: 'string' },
              description: { type: 'string' },
              notes: { type: 'string' },
              note: { type: 'string' },
              status: { type: 'string', enum: [...STATUSES] },
              mode: { type: 'string', enum: [...MODES] },
              budget: moneyProp('Budget.'),
              actualCost: moneyProp('Actual cost, or "none" to clear.'),
              amount: moneyProp('Payment amount.'),
              url: { type: 'string', description: 'Full https:// address.' },
              label: { type: 'string' },
            },
            required: ['op'],
          },
        },
      },
      required: ['summary', 'changes'],
    },
  },
]

// ---------------------------------------------------------------------------------------------
// Conversation history

export type EditStatus = 'pending' | 'applied' | 'partial' | 'undone' | 'dismissed' | 'invalid'

const EDIT_STATUS_TEXT: Record<EditStatus, string> = {
  pending: 'waiting for the planner to apply or dismiss it',
  applied: 'the planner applied it',
  partial: 'only part of it could be applied',
  undone: 'the planner applied it, then undid it',
  dismissed: 'the planner dismissed it; nothing changed',
  invalid: 'it couldn’t be applied to the current data; nothing changed',
}

/**
 * Chats are sent back as plain text, so charts and proposals are recorded in the assistant's
 * turn as short notes: Claude then knows what the planner saw and did.
 */
export const chartNote = (spec: ChartSpec) => `[Showed a chart: ${spec.title}]`
export const editNote = (summary: string, status: EditStatus) =>
  `[Proposed changes: ${summary} — ${EDIT_STATUS_TEXT[status]}]`
