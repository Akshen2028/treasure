/**
 * Soft-deletion rules for the Wedding → Event → Category → Activity → Payment tree.
 *
 * Each record has its own `deletedAt`. Deleting a parent only marks the parent;
 * its children are hidden because an ancestor is deleted, not because they were
 * changed. Restoring the parent therefore brings back exactly the children that
 * were not deleted separately.
 */
import type {
  Activity,
  EventCategory,
  Id,
  IsoTimestamp,
  Payment,
  WeddingEvent,
  WeddingSnapshot,
} from './types'

/** A snapshot containing only effectively active records. */
export type ActiveSnapshot = WeddingSnapshot

/** Filters a snapshot down to records that are active and have active ancestors. */
export function selectActive(snapshot: WeddingSnapshot): ActiveSnapshot {
  const categoryDefinitions = snapshot.categoryDefinitions.filter((d) => d.deletedAt === null)
  const definitionIds = new Set(categoryDefinitions.map((d) => d.id))
  const events = snapshot.events.filter((e) => e.deletedAt === null)
  const eventIds = new Set(events.map((e) => e.id))

  const eventCategories = snapshot.eventCategories.filter(
    (c) =>
      c.deletedAt === null && eventIds.has(c.eventId) && definitionIds.has(c.categoryDefinitionId),
  )
  const categoryIds = new Set(eventCategories.map((c) => c.id))

  const activities = snapshot.activities.filter(
    (a) => a.deletedAt === null && categoryIds.has(a.eventCategoryId),
  )
  const activityIds = new Set(activities.map((a) => a.id))

  const underActiveActivity = <T extends { activityId: Id; deletedAt: IsoTimestamp | null }>(
    rows: T[],
  ) => rows.filter((r) => r.deletedAt === null && activityIds.has(r.activityId))

  return {
    wedding: snapshot.wedding,
    categoryDefinitions,
    events,
    eventCategories,
    activities,
    activityImages: underActiveActivity(snapshot.activityImages),
    activityLinks: underActiveActivity(snapshot.activityLinks),
    payments: underActiveActivity(snapshot.payments),
  }
}

export type DeletableKind = 'definition' | 'event' | 'category' | 'activity' | 'payment'

export type DeletedItem = {
  kind: DeletableKind
  id: Id
  /** Human-readable name, e.g. "Decor" or "$1,200 on 2027-05-01". */
  label: string
  deletedAt: IsoTimestamp
  /** Names of the ancestors, for context such as "Reception › Decor". */
  context: string[]
  /**
   * The nearest ancestor that is itself deleted. While set, restoring this item
   * alone would not make it visible; the ancestor must be restored too.
   */
  hiddenBy: { kind: DeletableKind; id: Id; label: string } | null
}

type Lookup = {
  events: Map<Id, WeddingEvent>
  categories: Map<Id, EventCategory>
  activities: Map<Id, Activity>
  definitionNames: Map<Id, string>
}

function buildLookup(snapshot: WeddingSnapshot): Lookup {
  return {
    events: new Map(snapshot.events.map((e) => [e.id, e])),
    categories: new Map(snapshot.eventCategories.map((c) => [c.id, c])),
    activities: new Map(snapshot.activities.map((a) => [a.id, a])),
    definitionNames: new Map(snapshot.categoryDefinitions.map((d) => [d.id, d.name])),
  }
}

/** Display name of an event category, taken from its shared definition. */
export function eventCategoryName(
  category: EventCategory,
  definitionNames: Map<Id, string>,
): string {
  return definitionNames.get(category.categoryDefinitionId) ?? 'Unknown category'
}

type Ancestor = { kind: DeletableKind; id: Id; label: string; deletedAt: IsoTimestamp | null }

/** Ancestors from nearest to farthest. */
function ancestorsOf(kind: DeletableKind, id: Id, lookup: Lookup): Ancestor[] {
  const chain: Ancestor[] = []
  let activityId: Id | undefined
  let categoryId: Id | undefined
  let eventId: Id | undefined

  if (kind === 'payment') activityId = id
  if (kind === 'activity') categoryId = lookup.activities.get(id)?.eventCategoryId
  if (kind === 'category') eventId = lookup.categories.get(id)?.eventId

  if (activityId !== undefined) {
    const activity = lookup.activities.get(activityId)
    if (activity) {
      chain.push({
        kind: 'activity',
        id: activity.id,
        label: activity.name,
        deletedAt: activity.deletedAt,
      })
      categoryId = activity.eventCategoryId
    }
  }
  if (categoryId !== undefined) {
    const category = lookup.categories.get(categoryId)
    if (category) {
      chain.push({
        kind: 'category',
        id: category.id,
        label: eventCategoryName(category, lookup.definitionNames),
        deletedAt: category.deletedAt,
      })
      eventId = category.eventId
    }
  }
  if (eventId !== undefined) {
    const event = lookup.events.get(eventId)
    if (event)
      chain.push({ kind: 'event', id: event.id, label: event.name, deletedAt: event.deletedAt })
  }
  return chain
}

function toDeletedItem(
  kind: DeletableKind,
  id: Id,
  label: string,
  deletedAt: IsoTimestamp,
  ancestors: Ancestor[],
): DeletedItem {
  const hidden = ancestors.find((a) => a.deletedAt !== null)
  return {
    kind,
    id,
    label,
    deletedAt,
    context: ancestors.map((a) => a.label).reverse(),
    hiddenBy: hidden ? { kind: hidden.kind, id: hidden.id, label: hidden.label } : null,
  }
}

/**
 * Every soft-deleted event, category, activity and payment, newest first.
 * `formatPaymentLabel` keeps formatting concerns out of this module.
 */
export function listDeletedItems(
  snapshot: WeddingSnapshot,
  formatPaymentLabel: (payment: Payment) => string,
): DeletedItem[] {
  const lookup = buildLookup(snapshot)
  const items: DeletedItem[] = []

  for (const d of snapshot.categoryDefinitions) {
    if (d.deletedAt) items.push(toDeletedItem('definition', d.id, d.name, d.deletedAt, []))
  }
  for (const e of snapshot.events) {
    if (e.deletedAt) items.push(toDeletedItem('event', e.id, e.name, e.deletedAt, []))
  }
  for (const c of snapshot.eventCategories) {
    if (c.deletedAt) {
      const label = eventCategoryName(c, lookup.definitionNames)
      items.push(
        toDeletedItem('category', c.id, label, c.deletedAt, ancestorsOf('category', c.id, lookup)),
      )
    }
  }
  for (const a of snapshot.activities) {
    if (a.deletedAt) {
      items.push(
        toDeletedItem('activity', a.id, a.name, a.deletedAt, ancestorsOf('activity', a.id, lookup)),
      )
    }
  }
  for (const p of snapshot.payments) {
    if (p.deletedAt) {
      items.push(
        toDeletedItem(
          'payment',
          p.id,
          formatPaymentLabel(p),
          p.deletedAt,
          ancestorsOf('payment', p.activityId, lookup),
        ),
      )
    }
  }

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

/**
 * Restoring an event category is refused if the same category definition is
 * already active in that event, which keeps each category unique per event and
 * prevents double-counted totals. Returns the conflicting active category.
 */
export function findCategoryRestoreConflict(
  snapshot: WeddingSnapshot,
  eventCategoryId: Id,
): EventCategory | null {
  const target = snapshot.eventCategories.find((c) => c.id === eventCategoryId)
  if (!target) return null
  return (
    snapshot.eventCategories.find(
      (c) =>
        c.id !== target.id &&
        c.deletedAt === null &&
        c.eventId === target.eventId &&
        c.categoryDefinitionId === target.categoryDefinitionId,
    ) ?? null
  )
}
