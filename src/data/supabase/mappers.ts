/**
 * Translation between Supabase rows (snake_case) and domain types (camelCase).
 * Pure functions: the only place that knows both shapes.
 */
import type {
  Activity,
  ActivityImage,
  ActivityLink,
  CategoryDefinition,
  EventCategory,
  Payment,
  Wedding,
  WeddingEvent,
} from '@/domain/types'
import type { Database } from '@/lib/database.types'

import type {
  ActivityLinkPatch,
  ActivityPatch,
  EventCategoryPatch,
  EventPatch,
  NewActivity,
  NewActivityLink,
  NewCategoryDefinition,
  NewEvent,
  NewEventCategory,
  NewPayment,
  PaymentPatch,
  WeddingPatch,
} from '../repository'

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
type Insert<T extends keyof Tables> = Tables[T]['Insert']
type Update<T extends keyof Tables> = Tables[T]['Update']

const timestamps = (row: { created_at: string; updated_at: string }) => ({
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ---------------------------------------------------------------------------
// Rows → domain
// ---------------------------------------------------------------------------

export const toWedding = (r: Row<'weddings'>): Wedding => ({
  id: r.id,
  name: r.name,
  weddingDate: r.wedding_date,
  budgetMode: r.budget_mode,
  manualBudgetCents: r.manual_budget_cents,
  ...timestamps(r),
})

export const toCategoryDefinition = (r: Row<'category_definitions'>): CategoryDefinition => ({
  id: r.id,
  weddingId: r.wedding_id,
  name: r.name,
  isDefault: r.is_default,
  ...timestamps(r),
})

export const toEvent = (r: Row<'events'>): WeddingEvent => ({
  id: r.id,
  weddingId: r.wedding_id,
  name: r.name,
  eventDate: r.event_date,
  location: r.location,
  description: r.description,
  coverImagePath: r.cover_image_path,
  manualBudgetCents: r.manual_budget_cents,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

export const toEventCategory = (r: Row<'event_categories'>): EventCategory => ({
  id: r.id,
  eventId: r.event_id,
  categoryDefinitionId: r.category_definition_id,
  manualBudgetCents: r.manual_budget_cents,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

export const toActivity = (r: Row<'activities'>): Activity => ({
  id: r.id,
  eventCategoryId: r.event_category_id,
  name: r.name,
  description: r.description,
  notes: r.notes,
  status: r.status,
  budgetCents: r.budget_cents,
  actualCostCents: r.actual_cost_cents,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

export const toActivityImage = (r: Row<'activity_images'>): ActivityImage => ({
  id: r.id,
  activityId: r.activity_id,
  storagePath: r.storage_path,
  thumbnailPath: r.thumbnail_path,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  width: r.width,
  height: r.height,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

export const toActivityLink = (r: Row<'activity_links'>): ActivityLink => ({
  id: r.id,
  activityId: r.activity_id,
  url: r.url,
  label: r.label,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

export const toPayment = (r: Row<'payments'>): Payment => ({
  id: r.id,
  activityId: r.activity_id,
  amountCents: r.amount_cents,
  paidOn: r.paid_on,
  note: r.note,
  deletedAt: r.deleted_at,
  ...timestamps(r),
})

// ---------------------------------------------------------------------------
// Domain → rows. Undefined fields are omitted so partial patches only touch
// what changed; null is kept because it is a meaningful value (e.g. no date).
// ---------------------------------------------------------------------------

function compact<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as T
}

export const weddingPatchToRow = (p: WeddingPatch): Update<'weddings'> =>
  compact({
    name: p.name,
    wedding_date: p.weddingDate,
    budget_mode: p.budgetMode,
    manual_budget_cents: p.manualBudgetCents,
  })

export const eventPatchToRow = (p: EventPatch): Update<'events'> =>
  compact({
    name: p.name,
    event_date: p.eventDate,
    location: p.location,
    description: p.description,
    cover_image_path: p.coverImagePath,
    manual_budget_cents: p.manualBudgetCents,
    sort_order: p.sortOrder,
  })

export const newEventToRow = (n: NewEvent): Insert<'events'> =>
  compact({ wedding_id: n.weddingId, ...eventPatchToRow(n), name: n.name })

export const newCategoryDefinitionToRow = (
  n: NewCategoryDefinition,
): Insert<'category_definitions'> => ({ wedding_id: n.weddingId, name: n.name.trim() })

export const eventCategoryPatchToRow = (p: EventCategoryPatch): Update<'event_categories'> =>
  compact({ manual_budget_cents: p.manualBudgetCents, sort_order: p.sortOrder })

export const newEventCategoryToRow = (n: NewEventCategory): Insert<'event_categories'> =>
  compact({
    wedding_id: n.weddingId,
    event_id: n.eventId,
    category_definition_id: n.categoryDefinitionId,
    ...eventCategoryPatchToRow(n),
  })

export const activityPatchToRow = (p: ActivityPatch): Update<'activities'> =>
  compact({
    name: p.name,
    description: p.description,
    notes: p.notes,
    status: p.status,
    budget_cents: p.budgetCents,
    actual_cost_cents: p.actualCostCents,
    sort_order: p.sortOrder,
  })

export const newActivityToRow = (n: NewActivity): Insert<'activities'> =>
  compact({
    wedding_id: n.weddingId,
    event_category_id: n.eventCategoryId,
    ...activityPatchToRow(n),
    name: n.name,
  })

export const paymentPatchToRow = (p: PaymentPatch): Update<'payments'> =>
  compact({ amount_cents: p.amountCents, paid_on: p.paidOn, note: p.note })

export const newPaymentToRow = (n: NewPayment): Insert<'payments'> =>
  compact({
    wedding_id: n.weddingId,
    activity_id: n.activityId,
    amount_cents: n.amountCents,
    paid_on: n.paidOn,
    note: n.note,
  })

export const activityLinkPatchToRow = (p: ActivityLinkPatch): Update<'activity_links'> =>
  compact({ url: p.url, label: p.label, sort_order: p.sortOrder })

export const newActivityLinkToRow = (n: NewActivityLink): Insert<'activity_links'> =>
  compact({
    wedding_id: n.weddingId,
    activity_id: n.activityId,
    ...activityLinkPatchToRow(n),
    url: n.url,
  })
