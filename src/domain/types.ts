/**
 * Wedonomics domain model.
 *
 * These types are what the UI and the pure domain functions work with. They are
 * independent of Supabase: the data layer maps database rows into these shapes.
 *
 * Conventions
 * - Money is always integer CAD cents, in fields ending in `Cents`.
 * - Calendar dates are ISO `YYYY-MM-DD` strings; timestamps are ISO 8601 strings.
 * - Soft-deletable records carry `deletedAt` (null while active). A record is only
 *   *effectively* active when it and every ancestor are not deleted.
 */

export type Id = string

/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string

/** Point in time, ISO 8601 with timezone. */
export type IsoTimestamp = string

/**
 * Wedding-wide budget mode, applied to every level above activities.
 * - auto: category, event and wedding budgets are sums of their children,
 *   bubbling up from activity budgets.
 * - manual: category, event and wedding budgets are each entered by hand and
 *   never change when children change.
 * Activity budgets are always entered by hand. Switching from auto to manual
 * starts every level at its current calculated total (see `manualBudgetsFromCalculated`).
 */
export const BUDGET_MODES = ['auto', 'manual'] as const
export type BudgetMode = (typeof BUDGET_MODES)[number]

/** Public: anyone can view and find it in search. Private: only people with the share link. */
export const WEDDING_VISIBILITIES = ['public', 'private'] as const
export type WeddingVisibility = (typeof WEDDING_VISIBILITIES)[number]

/** What guests see: real amounts, or each figure as a share of the wedding's total budget. */
export const GUEST_AMOUNTS = ['amounts', 'percentages'] as const
export type GuestAmounts = (typeof GUEST_AMOUNTS)[number]

export const ACTIVITY_STATUSES = ['idea', 'planned', 'booked', 'completed'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

type Timestamps = {
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

type SoftDeletable = {
  deletedAt: IsoTimestamp | null
}

export type Wedding = Timestamps & {
  id: Id
  name: string
  weddingDate: IsoDate | null
  budgetMode: BudgetMode
  /** Wedding budget in manual mode; ignored in auto mode. */
  manualBudgetCents: number
  visibility: WeddingVisibility
  guestAmounts: GuestAmounts
}

/**
 * Wedding-wide category (Food, Decor, ...), reusable across events. Custom ones can be
 * soft-deleted when no event uses them; the seven defaults never can.
 */
export type CategoryDefinition = Timestamps &
  SoftDeletable & {
    id: Id
    weddingId: Id
    name: string
    isDefault: boolean
    sortOrder: number
  }

export type WeddingEvent = Timestamps &
  SoftDeletable & {
    id: Id
    weddingId: Id
    name: string
    eventDate: IsoDate | null
    location: string
    description: string
    /** Storage object path, not a URL. */
    coverImagePath: string | null
    /** Event budget in manual mode; ignored in auto mode. */
    manualBudgetCents: number
    sortOrder: number
  }

/** A category definition used within one event. */
export type EventCategory = Timestamps &
  SoftDeletable & {
    id: Id
    eventId: Id
    categoryDefinitionId: Id
    /** Category budget in manual mode; ignored in auto mode. */
    manualBudgetCents: number
    sortOrder: number
  }

export type Activity = Timestamps &
  SoftDeletable & {
    id: Id
    eventCategoryId: Id
    name: string
    description: string
    notes: string
    status: ActivityStatus
    /** Always manually entered. */
    budgetCents: number
    /** Optional; null until the real cost is known. */
    actualCostCents: number | null
    sortOrder: number
  }

export type ActivityImage = Timestamps &
  SoftDeletable & {
    id: Id
    activityId: Id
    storagePath: string
    thumbnailPath: string | null
    mimeType: string
    sizeBytes: number
    width: number | null
    height: number | null
    sortOrder: number
  }

export type ActivityLink = Timestamps &
  SoftDeletable & {
    id: Id
    activityId: Id
    url: string
    label: string
    sortOrder: number
  }

/** One installment toward an activity. */
export type Payment = Timestamps &
  SoftDeletable & {
    id: Id
    activityId: Id
    amountCents: number
    paidOn: IsoDate
    note: string
  }

/**
 * A level's figures for guests in percentage mode, in parts per million of the wedding's
 * total budget (`SHARE_SCALE`), with the over-budget flag computed from the real amounts.
 */
export type ShareFigures = { budget: number; paid: number; child: number; over: boolean }
export type ActivityShareFigures = { budget: number; paid: number; over: boolean; payments: number }

/** Budget figures sent to guests instead of amounts. Keyed by record id. */
export type GuestFigures = {
  wedding: ShareFigures
  events: Record<Id, ShareFigures>
  categories: Record<Id, ShareFigures>
  activities: Record<Id, ActivityShareFigures>
}

/** Everything about one wedding, including soft-deleted records. */
export type WeddingSnapshot = {
  wedding: Wedding
  categoryDefinitions: CategoryDefinition[]
  events: WeddingEvent[]
  eventCategories: EventCategory[]
  activities: Activity[]
  activityImages: ActivityImage[]
  activityLinks: ActivityLink[]
  payments: Payment[]
  /**
   * Present only for guests when the wedding shows percentages: every money field in the
   * records is then blanked, and these figures replace them.
   */
  guestFigures?: GuestFigures | null
}
