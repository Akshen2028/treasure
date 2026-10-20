/**
 * Test-only builders for domain fixtures. Not imported by application code.
 */
import type {
  Activity,
  BudgetMode,
  CategoryDefinition,
  EventCategory,
  Payment,
  Wedding,
  WeddingEvent,
  WeddingSnapshot,
} from '../types'

const TS = '2026-10-01T12:00:00.000Z'
const DELETED_TS = '2026-10-10T12:00:00.000Z'

export const deleted = { deletedAt: DELETED_TS } as const

/** Builds a snapshot by adding records in tree order; ids are readable for assertions. */
export class SnapshotBuilder {
  private snapshot: WeddingSnapshot

  /**
   * @param mode Wedding-wide budget mode.
   * @param manualBudgetCents Wedding budget used in manual mode.
   */
  constructor(mode: BudgetMode = 'auto', manualBudgetCents = 0) {
    const wedding: Wedding = {
      id: 'w1',
      name: 'Test Wedding',
      weddingDate: '2027-06-12',
      budgetMode: mode,
      manualBudgetCents,
      visibility: 'public',
      guestAmounts: 'amounts',
      createdAt: TS,
      updatedAt: TS,
    }
    this.snapshot = {
      wedding,
      categoryDefinitions: [],
      events: [],
      eventCategories: [],
      activities: [],
      activityImages: [],
      activityLinks: [],
      payments: [],
    }
  }

  definition(id: string, name = id, extra: Partial<CategoryDefinition> = {}): this {
    const def: CategoryDefinition = {
      id,
      weddingId: 'w1',
      name,
      isDefault: false,
      sortOrder: 0,
      deletedAt: null,
      ...extra,
      createdAt: TS,
      updatedAt: TS,
    }
    this.snapshot.categoryDefinitions.push(def)
    return this
  }

  /** `manualBudgetCents` only matters when the wedding is in manual mode. */
  event(id: string, manualBudgetCents = 0, extra: Partial<WeddingEvent> = {}): this {
    this.snapshot.events.push({
      id,
      weddingId: 'w1',
      name: id,
      eventDate: null,
      location: '',
      description: '',
      coverImagePath: null,
      manualBudgetCents,
      sortOrder: this.snapshot.events.length,
      deletedAt: null,
      createdAt: TS,
      updatedAt: TS,
      ...extra,
    })
    return this
  }

  /**
   * Adds an event category; the category definition is created on first use.
   * `manualBudgetCents` only matters when the wedding is in manual mode.
   */
  category(
    id: string,
    eventId: string,
    definitionId: string,
    manualBudgetCents = 0,
    extra: Partial<EventCategory> = {},
  ): this {
    if (!this.snapshot.categoryDefinitions.some((d) => d.id === definitionId)) {
      this.definition(definitionId)
    }
    this.snapshot.eventCategories.push({
      id,
      eventId,
      categoryDefinitionId: definitionId,
      manualBudgetCents,
      sortOrder: this.snapshot.eventCategories.length,
      deletedAt: null,
      createdAt: TS,
      updatedAt: TS,
      ...extra,
    })
    return this
  }

  activity(
    id: string,
    eventCategoryId: string,
    budgetCents: number,
    extra: Partial<Activity> = {},
  ): this {
    this.snapshot.activities.push({
      id,
      eventCategoryId,
      name: id,
      description: '',
      notes: '',
      status: 'planned',
      budgetCents,
      actualCostCents: null,
      sortOrder: this.snapshot.activities.length,
      deletedAt: null,
      createdAt: TS,
      updatedAt: TS,
      ...extra,
    })
    return this
  }

  payment(id: string, activityId: string, amountCents: number, extra: Partial<Payment> = {}): this {
    this.snapshot.payments.push({
      id,
      activityId,
      amountCents,
      paidOn: '2026-09-01',
      note: '',
      deletedAt: null,
      createdAt: TS,
      updatedAt: TS,
      ...extra,
    })
    return this
  }

  build(): WeddingSnapshot {
    return structuredClone(this.snapshot)
  }
}

type Collection = 'categoryDefinitions' | 'events' | 'eventCategories' | 'activities' | 'payments'

/** Returns a copy of the snapshot with the wedding changed, e.g. its budget mode. */
export function withWedding(
  snapshot: WeddingSnapshot,
  change: Partial<WeddingSnapshot['wedding']>,
): WeddingSnapshot {
  const next = structuredClone(snapshot)
  next.wedding = { ...next.wedding, ...change }
  return next
}

/** Returns a copy of the snapshot with one record changed, like a database update. */
export function withChange<K extends Collection>(
  snapshot: WeddingSnapshot,
  collection: K,
  id: string,
  change: Partial<WeddingSnapshot[K][number]>,
): WeddingSnapshot {
  const next = structuredClone(snapshot)
  const rows = next[collection] as Array<{ id: string }>
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) throw new Error(`No ${collection} row with id ${id}`)
  rows[index] = { ...rows[index], ...change } as { id: string }
  return next
}
