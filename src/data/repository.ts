/**
 * The data contract the UI depends on. Pages and hooks talk to this interface, never to
 * Supabase directly, so the storage backend can change without touching the UI.
 *
 * All inputs and outputs are domain types (camelCase, integer cents). Permissions are not
 * checked here: the database enforces them and rejects unauthorized writes.
 */
import type {
  Activity,
  ActivityLink,
  CategoryDefinition,
  EventCategory,
  Id,
  Payment,
  Wedding,
  WeddingEvent,
  WeddingSnapshot,
} from '@/domain/types'

/** Records that support soft deletion and restore. */
export type SoftDeletableKind =
  'definition' | 'event' | 'category' | 'activity' | 'payment' | 'link' | 'image'

export type WeddingPatch = Partial<
  Pick<Wedding, 'name' | 'weddingDate' | 'budgetMode' | 'manualBudgetCents'>
>

export type NewEvent = Pick<WeddingEvent, 'weddingId' | 'name'> &
  Partial<
    Pick<
      WeddingEvent,
      | 'eventDate'
      | 'location'
      | 'description'
      | 'coverImagePath'
      | 'manualBudgetCents'
      | 'sortOrder'
    >
  >
export type EventPatch = Partial<Omit<NewEvent, 'weddingId'>>

export type NewCategoryDefinition = Pick<CategoryDefinition, 'weddingId' | 'name'>

export type NewEventCategory = Pick<EventCategory, 'eventId' | 'categoryDefinitionId'> & {
  weddingId: Id
} & Partial<Pick<EventCategory, 'manualBudgetCents' | 'sortOrder'>>
export type EventCategoryPatch = Partial<Pick<EventCategory, 'manualBudgetCents' | 'sortOrder'>>

export type NewActivity = Pick<Activity, 'eventCategoryId' | 'name'> & { weddingId: Id } & Partial<
    Pick<
      Activity,
      'description' | 'notes' | 'status' | 'budgetCents' | 'actualCostCents' | 'sortOrder'
    >
  >
export type ActivityPatch = Partial<Omit<NewActivity, 'weddingId' | 'eventCategoryId'>>

export type NewPayment = Pick<Payment, 'activityId' | 'amountCents' | 'paidOn'> & {
  weddingId: Id
} & Partial<Pick<Payment, 'note'>>
export type PaymentPatch = Partial<Pick<Payment, 'amountCents' | 'paidOn' | 'note'>>

export type NewActivityLink = Pick<ActivityLink, 'activityId' | 'url'> & {
  weddingId: Id
} & Partial<Pick<ActivityLink, 'label' | 'sortOrder'>>
export type ActivityLinkPatch = Partial<Pick<ActivityLink, 'url' | 'label' | 'sortOrder'>>

/** Thrown when the wedding the app is configured for does not exist. */
export class WeddingNotFoundError extends Error {
  readonly slug: string

  constructor(slug: string) {
    super(`No wedding with slug "${slug}"`)
    this.name = 'WeddingNotFoundError'
    this.slug = slug
  }
}

/** A write the database refused, with a reason the UI can explain. */
export type RepositoryErrorReason =
  'forbidden' | 'conflict' | 'invalid' | 'not-found' | 'network' | 'unknown'

export class RepositoryError extends Error {
  readonly reason: RepositoryErrorReason

  constructor(reason: RepositoryErrorReason, message: string) {
    super(message)
    this.name = 'RepositoryError'
    this.reason = reason
  }
}

export interface WeddingRepository {
  /**
   * Loads everything about a wedding. Planners also receive soft-deleted records
   * (for Recently Deleted); guests receive active records only.
   */
  loadSnapshot(slug: string): Promise<WeddingSnapshot>

  updateWedding(id: Id, patch: WeddingPatch): Promise<Wedding>

  createEvent(input: NewEvent): Promise<WeddingEvent>
  updateEvent(id: Id, patch: EventPatch): Promise<WeddingEvent>

  createCategoryDefinition(input: NewCategoryDefinition): Promise<CategoryDefinition>
  renameCategoryDefinition(id: Id, name: string): Promise<CategoryDefinition>

  createEventCategory(input: NewEventCategory): Promise<EventCategory>
  updateEventCategory(id: Id, patch: EventCategoryPatch): Promise<EventCategory>

  createActivity(input: NewActivity): Promise<Activity>
  updateActivity(id: Id, patch: ActivityPatch): Promise<Activity>

  createPayment(input: NewPayment): Promise<Payment>
  updatePayment(id: Id, patch: PaymentPatch): Promise<Payment>

  createActivityLink(input: NewActivityLink): Promise<ActivityLink>
  updateActivityLink(id: Id, patch: ActivityLinkPatch): Promise<ActivityLink>

  /** Marks a record deleted. Its children are hidden, not modified. */
  softDelete(kind: SoftDeletableKind, id: Id): Promise<void>
  /** Clears a record's deletion. Fails with 'conflict' if it would duplicate a category. */
  restore(kind: SoftDeletableKind, id: Id): Promise<void>
}
