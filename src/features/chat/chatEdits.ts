/**
 * Turns a proposal from the assistant into concrete steps against the current data: refs
 * become ids, each change gets a sentence for the review card, and anything that can't apply
 * (a record deleted since, a budget that wouldn't count in auto mode) is reported as a
 * problem, which keeps the Apply button off. Pure, so it is unit-tested.
 */
import type {
  ActivityLinkPatch,
  ActivityPatch,
  EventPatch,
  NewActivity,
  NewEvent,
  PaymentPatch,
  SoftDeletableKind,
  WeddingPatch,
} from '@/data/repository'
import type { EditChange, EditProposal } from '@/domain/chatTools'
import { formatDate } from '@/domain/dates'
import type { ActiveSnapshot } from '@/domain/hierarchy'
import { formatCad } from '@/domain/money'
import type { BudgetMode, Id } from '@/domain/types'
import { STATUS_LABELS } from '@/features/activities/activityForm'
import { normalizeCategoryName } from '@/features/categories/categoryLogic'

import type { RefTarget } from './chatRefs'

/** A parent that already exists, or one created by an earlier step ("N1"). */
export type ParentRef = { id: Id } | { created: string }

export type EditStep =
  | { op: 'update_wedding'; id: Id; patch: WeddingPatch; before: WeddingPatch }
  | { op: 'set_budget_mode'; mode: BudgetMode }
  | { op: 'create_event'; as: string | null; input: Omit<NewEvent, 'weddingId'> }
  | { op: 'update_event'; id: Id; patch: EventPatch; before: EventPatch }
  | {
      op: 'add_category'
      as: string | null
      event: ParentRef
      definitionId: Id | null
      newName: string | null
      manualBudgetCents?: number
    }
  | {
      op: 'update_category'
      id: Id
      definitionId: Id
      name?: { after: string; before: string }
      manualBudgetCents?: { after: number; before: number }
    }
  | {
      op: 'create_activity'
      as: string | null
      category: ParentRef
      input: Omit<NewActivity, 'weddingId' | 'eventCategoryId'>
    }
  | { op: 'update_activity'; id: Id; patch: ActivityPatch; before: ActivityPatch }
  | { op: 'add_payment'; activity: ParentRef; amountCents: number; paidOn: string; note: string }
  | { op: 'update_payment'; id: Id; patch: PaymentPatch; before: PaymentPatch }
  | { op: 'add_link'; activity: ParentRef; url: string; label: string }
  | { op: 'update_link'; id: Id; patch: ActivityLinkPatch; before: ActivityLinkPatch }
  | { op: 'delete'; kind: SoftDeletableKind; id: Id; label: string }

export type ResolvedEdit = {
  summary: string
  steps: Array<{ step: EditStep; text: string }>
  /** Reasons the proposal can't be applied as it stands. */
  problems: string[]
}

class Problem extends Error {}

const money = (cents: number) => formatCad(cents)
const day = (date: string | null | undefined) => (date ? formatDate(date) : 'no date')
const quoted = (text: string) => `“${text}”`

/** Keeps only the fields that actually change, with their current values for Undo. */
function diff<T extends object>(after: T, current: T): { patch: T; before: T } {
  const patch: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    const old = (current as Record<string, unknown>)[key]
    if (value !== undefined && value !== old) {
      patch[key] = value
      before[key] = old
    }
  }
  return { patch: patch as T, before: before as T }
}

type Formatter = (value: unknown) => string
const show = {
  text: ((v) => (v ? quoted(String(v)) : 'empty')) as Formatter,
  long: ((v) => (v ? 'updated text' : 'empty')) as Formatter,
  money: ((v) => (v === null ? 'not set' : money(Number(v)))) as Formatter,
  date: ((v) => day(v as string | null)) as Formatter,
  status: ((v) => STATUS_LABELS[v as keyof typeof STATUS_LABELS]) as Formatter,
}

const FIELDS: Record<string, { label: string; format: Formatter }> = {
  name: { label: 'name', format: show.text },
  weddingDate: { label: 'date', format: show.date },
  eventDate: { label: 'date', format: show.date },
  location: { label: 'location', format: show.text },
  description: { label: 'description', format: show.long },
  notes: { label: 'notes', format: show.long },
  note: { label: 'note', format: show.text },
  status: { label: 'status', format: show.status },
  budgetCents: { label: 'budget', format: show.money },
  manualBudgetCents: { label: 'budget', format: show.money },
  actualCostCents: { label: 'actual cost', format: show.money },
  amountCents: { label: 'amount', format: show.money },
  paidOn: { label: 'date', format: show.date },
  url: { label: 'address', format: show.text },
  label: { label: 'label', format: show.text },
}

/** "budget $3,000 → $3,400; status Planned → Booked" */
function describeChanges(patch: object, before: object): string {
  return Object.entries(patch)
    .map(([key, value]) => {
      const field = FIELDS[key] ?? { label: key, format: show.text }
      const old = (before as Record<string, unknown>)[key]
      if (field.format === show.long) return `${field.label} ${value ? 'updated' : 'cleared'}`
      return `${field.label} ${field.format(old)} → ${field.format(value)}`
    })
    .join('; ')
}

/** "budget $1,000, status Booked" for new records. */
function describeFields(fields: object, skip: string[] = []): string {
  const parts = Object.entries(fields)
    .filter(([key, value]) => !skip.includes(key) && value !== undefined && value !== '')
    .map(([key, value]) => {
      const field = FIELDS[key] ?? { label: key, format: show.text }
      if (field.format === show.long) return `with ${field.label}`
      return `${field.label} ${field.format(value)}`
    })
  return parts.length ? `: ${parts.join(', ')}` : ''
}

export function resolveEdit(
  proposal: EditProposal,
  active: ActiveSnapshot,
  targets: Map<string, RefTarget>,
): ResolvedEdit {
  const events = new Map(active.events.map((e) => [e.id, e]))
  const categories = new Map(active.eventCategories.map((c) => [c.id, c]))
  const definitions = new Map(active.categoryDefinitions.map((d) => [d.id, d]))
  const activities = new Map(active.activities.map((a) => [a.id, a]))
  const payments = new Map(active.payments.map((p) => [p.id, p]))
  const links = new Map(active.activityLinks.map((l) => [l.id, l]))

  const categoryName = (id: Id) => {
    const category = categories.get(id)
    return (category && definitions.get(category.categoryDefinitionId)?.name) ?? 'Category'
  }
  const categoryPath = (id: Id) => {
    const category = categories.get(id)
    return `${events.get(category?.eventId ?? '')?.name ?? 'Event'} › ${categoryName(id)}`
  }

  /** Names of records created earlier in this proposal, for descriptions. */
  const created = new Map<string, string>()
  let mode = active.wedding.budgetMode

  function existing<T>(ref: string, rows: Map<Id, T>): { id: Id; row: T } {
    const target = targets.get(ref)
    const row = target && rows.get(target.id)
    if (!target || !row) throw new Problem(`${ref} no longer exists. Ask again to refresh.`)
    return { id: target.id, row }
  }

  function parent<T>(ref: string, rows: Map<Id, T>, label: (id: Id) => string) {
    if (created.has(ref)) return { parent: { created: ref }, label: created.get(ref)! }
    const { id } = existing(ref, rows)
    return { parent: { id }, label: label(id) }
  }

  function manualOnly(what: string, cents: number | undefined) {
    if (cents !== undefined && mode === 'auto') {
      throw new Problem(
        `${what} budget only counts in manual budget mode; in auto mode it’s the sum of its activities.`,
      )
    }
  }

  function resolve(change: EditChange): { step: EditStep; text: string } | null {
    switch (change.op) {
      case 'update_wedding': {
        manualOnly('The wedding', change.budgetCents)
        const { wedding } = active
        const { patch, before } = diff<WeddingPatch>(
          { name: change.name, weddingDate: change.date, manualBudgetCents: change.budgetCents },
          wedding,
        )
        if (!Object.keys(patch).length) return null
        return {
          step: { op: 'update_wedding', id: wedding.id, patch, before },
          text: `Wedding: ${describeChanges(patch, before)}`,
        }
      }
      case 'set_budget_mode': {
        if (change.mode === mode) return null
        const from = mode
        mode = change.mode
        return {
          step: { op: 'set_budget_mode', mode: change.mode },
          text:
            change.mode === 'manual'
              ? 'Switch to manual budgets: every event and category keeps its current total as its own amount'
              : `Switch budget mode ${from} → auto: event and category budgets become sums of their activities`,
        }
      }
      case 'create_event': {
        manualOnly('An event', change.budgetCents)
        const input: Omit<NewEvent, 'weddingId'> = {
          name: change.name,
          ...(change.date !== undefined && { eventDate: change.date }),
          ...(change.location !== undefined && { location: change.location }),
          ...(change.description !== undefined && { description: change.description }),
          ...(change.budgetCents !== undefined && { manualBudgetCents: change.budgetCents }),
        }
        if (change.as) created.set(change.as, change.name)
        return {
          step: { op: 'create_event', as: change.as, input },
          text: `New event ${quoted(change.name)}${describeFields(input, ['name'])}`,
        }
      }
      case 'update_event': {
        const { id, row } = existing(change.event, events)
        manualOnly(row.name, change.budgetCents)
        const { patch, before } = diff<EventPatch>(
          {
            name: change.name,
            eventDate: change.date,
            location: change.location,
            description: change.description,
            manualBudgetCents: change.budgetCents,
          },
          row,
        )
        if (!Object.keys(patch).length) return null
        return {
          step: { op: 'update_event', id, patch, before },
          text: `Event ${quoted(row.name)}: ${describeChanges(patch, before)}`,
        }
      }
      case 'add_category': {
        const event = parent(change.event, events, (id) => events.get(id)!.name)
        let definitionId = change.definition ? existing(change.definition, definitions).id : null
        let newName = change.name
        if (newName) {
          // A "new" category with an existing name is the existing shared category.
          const match = active.categoryDefinitions.find(
            (d) => normalizeCategoryName(d.name) === normalizeCategoryName(newName!),
          )
          if (match) {
            definitionId = match.id
            newName = null
          }
        }
        const name = newName ?? definitions.get(definitionId!)!.name
        if (
          'id' in event.parent &&
          active.eventCategories.some(
            (c) =>
              c.eventId === (event.parent as { id: Id }).id &&
              c.categoryDefinitionId === definitionId,
          )
        ) {
          throw new Problem(`${event.label} already has ${name}.`)
        }
        manualOnly(name, change.budgetCents)
        if (change.as) created.set(change.as, `${event.label} › ${name}`)
        return {
          step: {
            op: 'add_category',
            as: change.as,
            event: event.parent,
            definitionId,
            newName,
            ...(change.budgetCents !== undefined && { manualBudgetCents: change.budgetCents }),
          },
          text:
            `Add ${quoted(name)} to ${event.label}` +
            (newName ? ' (a new shared category)' : '') +
            (change.budgetCents !== undefined ? `: budget ${money(change.budgetCents)}` : ''),
        }
      }
      case 'update_category': {
        const { id, row } = existing(change.category, categories)
        const definition = definitions.get(row.categoryDefinitionId)!
        manualOnly(categoryPath(id), change.budgetCents)
        const rename =
          change.name !== undefined && change.name !== definition.name
            ? { after: change.name, before: definition.name }
            : undefined
        if (rename) {
          const clash = active.categoryDefinitions.find(
            (d) =>
              d.id !== definition.id &&
              normalizeCategoryName(d.name) === normalizeCategoryName(rename.after),
          )
          if (clash) throw new Problem(`A category called ${quoted(clash.name)} already exists.`)
        }
        const budget =
          change.budgetCents !== undefined && change.budgetCents !== row.manualBudgetCents
            ? { after: change.budgetCents, before: row.manualBudgetCents }
            : undefined
        if (!rename && !budget) return null
        const parts = [
          rename && `rename ${quoted(rename.before)} → ${quoted(rename.after)} in every event`,
          budget && `budget ${money(budget.before)} → ${money(budget.after)}`,
        ].filter(Boolean)
        return {
          step: {
            op: 'update_category',
            id,
            definitionId: definition.id,
            ...(rename && { name: rename }),
            ...(budget && { manualBudgetCents: budget }),
          },
          text: `Category ${categoryPath(id)}: ${parts.join('; ')}`,
        }
      }
      case 'create_activity': {
        const category = parent(change.category, categories, categoryPath)
        const { op: _op, as: _as, category: _category, ...input } = change
        if (change.as) created.set(change.as, quoted(change.name))
        return {
          step: { op: 'create_activity', as: change.as, category: category.parent, input },
          text: `New activity ${quoted(change.name)} in ${category.label}${describeFields(input, ['name'])}`,
        }
      }
      case 'update_activity': {
        const { id, row } = existing(change.activity, activities)
        const { op: _op, activity: _activity, ...fields } = change
        const { patch, before } = diff<ActivityPatch>(fields, row)
        if (!Object.keys(patch).length) return null
        return {
          step: { op: 'update_activity', id, patch, before },
          text: `Activity ${quoted(row.name)}: ${describeChanges(patch, before)}`,
        }
      }
      case 'add_payment': {
        const activity = parent(change.activity, activities, (id) =>
          quoted(activities.get(id)!.name),
        )
        return {
          step: {
            op: 'add_payment',
            activity: activity.parent,
            amountCents: change.amountCents,
            paidOn: change.date,
            note: change.note ?? '',
          },
          text:
            `Payment of ${money(change.amountCents)} on ${day(change.date)} for ${activity.label}` +
            (change.note ? ` (${change.note})` : ''),
        }
      }
      case 'update_payment': {
        const { id, row } = existing(change.payment, payments)
        const { patch, before } = diff<PaymentPatch>(
          { amountCents: change.amountCents, paidOn: change.date, note: change.note },
          row,
        )
        if (!Object.keys(patch).length) return null
        const activity = activities.get(row.activityId)
        return {
          step: { op: 'update_payment', id, patch, before },
          text: `Payment of ${money(row.amountCents)} for ${quoted(activity?.name ?? 'activity')}: ${describeChanges(patch, before)}`,
        }
      }
      case 'add_link': {
        const activity = parent(change.activity, activities, (id) =>
          quoted(activities.get(id)!.name),
        )
        return {
          step: {
            op: 'add_link',
            activity: activity.parent,
            url: change.url,
            label: change.label ?? '',
          },
          text: `Link ${change.label ? `${quoted(change.label)} ` : ''}(${change.url}) on ${activity.label}`,
        }
      }
      case 'update_link': {
        const { id, row } = existing(change.link, links)
        const { patch, before } = diff<ActivityLinkPatch>(
          { url: change.url, label: change.label },
          row,
        )
        if (!Object.keys(patch).length) return null
        return {
          step: { op: 'update_link', id, patch, before },
          text: `Link ${quoted(row.label || row.url)}: ${describeChanges(patch, before)}`,
        }
      }
      case 'delete': {
        const target = targets.get(change.target)
        const kind = target?.kind
        if (kind === 'event') {
          const { id, row } = existing(change.target, events)
          return {
            step: { op: 'delete', kind, id, label: row.name },
            text: `Delete event ${quoted(row.name)} and everything in it`,
          }
        }
        if (kind === 'category') {
          const { id } = existing(change.target, categories)
          return {
            step: { op: 'delete', kind, id, label: categoryName(id) },
            text: `Remove ${categoryPath(id)} and its activities`,
          }
        }
        if (kind === 'activity') {
          const { id, row } = existing(change.target, activities)
          return {
            step: { op: 'delete', kind, id, label: row.name },
            text: `Delete activity ${quoted(row.name)} with its payments, links and photos`,
          }
        }
        if (kind === 'payment') {
          const { id, row } = existing(change.target, payments)
          const activity = activities.get(row.activityId)
          return {
            step: { op: 'delete', kind, id, label: 'Payment' },
            text: `Delete the ${money(row.amountCents)} payment of ${day(row.paidOn)} for ${quoted(activity?.name ?? 'activity')}`,
          }
        }
        if (kind === 'link') {
          const { id, row } = existing(change.target, links)
          return {
            step: { op: 'delete', kind, id, label: 'Link' },
            text: `Delete link ${quoted(row.label || row.url)}`,
          }
        }
        throw new Problem(`${change.target} no longer exists. Ask again to refresh.`)
      }
    }
  }

  const steps: ResolvedEdit['steps'] = []
  const problems: string[] = []
  for (const change of proposal.changes) {
    try {
      const step = resolve(change)
      if (step) steps.push(step)
    } catch (error) {
      if (!(error instanceof Problem)) throw error
      problems.push(error.message)
    }
  }
  if (!steps.length && !problems.length) problems.push('Nothing to change: it already matches.')
  return { summary: proposal.summary, steps, problems }
}
