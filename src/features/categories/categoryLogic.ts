import type { ActiveSnapshot } from '@/domain/hierarchy'
import { centsToInput, parseCadInput } from '@/domain/money'
import type {
  BudgetMode,
  CategoryDefinition,
  EventCategory,
  Id,
  WeddingEvent,
  WeddingSnapshot,
} from '@/domain/types'

/** Comparison key: case-insensitive, ignoring surrounding and repeated spaces. */
export const normalizeCategoryName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-CA')

/** Library order: the seven defaults in their set order, then custom ones alphabetically. */
export function sortDefinitions(definitions: CategoryDefinition[]): CategoryDefinition[] {
  return [...definitions].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    if (a.isDefault) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name, 'en-CA', { sensitivity: 'base' })
  })
}

export type LibraryOption = { definition: CategoryDefinition; inThisEvent: boolean }

/** Every shared category, marking those already active in the given event. */
export function libraryForEvent(active: ActiveSnapshot, eventId: Id): LibraryOption[] {
  const used = new Set(
    active.eventCategories.filter((c) => c.eventId === eventId).map((c) => c.categoryDefinitionId),
  )
  return sortDefinitions(active.categoryDefinitions).map((definition) => ({
    definition,
    inThisEvent: used.has(definition.id),
  }))
}

/**
 * Custom categories that can be deleted: not a default, and not used by any active event
 * category. Uses the full snapshot, because a category under a deleted event would come back
 * if that event were restored. The database enforces the same rule.
 */
export function deletableDefinitionIds(snapshot: WeddingSnapshot): Set<Id> {
  const inUse = new Set(
    snapshot.eventCategories.filter((c) => c.deletedAt === null).map((c) => c.categoryDefinitionId),
  )
  return new Set(
    snapshot.categoryDefinitions
      .filter((d) => d.deletedAt === null && !d.isDefault && !inUse.has(d.id))
      .map((d) => d.id),
  )
}

/** The existing definition with this name, if any, so typing "decor" reuses "Decor". */
export function findDefinitionByName(
  definitions: CategoryDefinition[],
  name: string,
): CategoryDefinition | undefined {
  const key = normalizeCategoryName(name)
  return definitions.find((d) => normalizeCategoryName(d.name) === key)
}

/** An event's active categories in display order, paired with their definitions. */
export function categoriesForEvent(
  active: ActiveSnapshot,
  eventId: Id,
): Array<{ category: EventCategory; definition: CategoryDefinition }> {
  const definitions = new Map(active.categoryDefinitions.map((d) => [d.id, d]))
  return active.eventCategories
    .filter((c) => c.eventId === eventId)
    .flatMap((category) => {
      const definition = definitions.get(category.categoryDefinitionId)
      return definition ? [{ category, definition }] : []
    })
    .sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.category.createdAt.localeCompare(b.category.createdAt),
    )
}

/** Other active events that use the same shared category. */
export function otherEventsUsing(
  active: ActiveSnapshot,
  definitionId: Id,
  exceptEventId: Id,
): Array<{ event: WeddingEvent; eventCategoryId: Id }> {
  const events = new Map(active.events.map((e) => [e.id, e]))
  return active.eventCategories.flatMap((c) => {
    if (c.categoryDefinitionId !== definitionId || c.eventId === exceptEventId) return []
    const event = events.get(c.eventId)
    return event ? [{ event, eventCategoryId: c.id }] : []
  })
}

export function activityCount(active: ActiveSnapshot, eventCategoryId: Id): number {
  return active.activities.filter((a) => a.eventCategoryId === eventCategoryId).length
}

export function validateCategoryName(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'Give the category a name.'
  if (trimmed.length > 60) return 'Keep the name under 60 characters.'
  return undefined
}

/** Parses the manual budget field: blank means $0, anything else must be a valid amount. */
export function parseManualBudget(
  raw: string,
  mode: BudgetMode,
): { ok: true; cents: number | undefined } | { ok: false; error: string } {
  if (mode !== 'manual') return { ok: true, cents: undefined }
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, cents: 0 }
  const cents = parseCadInput(trimmed)
  return cents === null
    ? { ok: false, error: 'Enter an amount like 2,500 or 2500.00.' }
    : { ok: true, cents }
}

export const manualBudgetInput = (cents: number) => (cents ? centsToInput(cents) : '')
