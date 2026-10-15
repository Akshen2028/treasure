import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Id, WeddingSnapshot } from '@/domain/types'
import type { Database } from '@/lib/database.types'

import {
  RepositoryError,
  type SoftDeletableKind,
  WeddingNotFoundError,
  type WeddingRepository,
} from '../repository'
import * as map from './mappers'

type Client = SupabaseClient<Database>
type TableName = keyof Database['public']['Tables']

const SOFT_DELETE_TABLES = {
  event: 'events',
  category: 'event_categories',
  activity: 'activities',
  payment: 'payments',
  link: 'activity_links',
  image: 'activity_images',
} as const satisfies Record<SoftDeletableKind, TableName>

/** PostgREST returns at most this many rows per request by default. */
const PAGE_SIZE = 1000

/** Translates a database error into a reason the UI can explain. */
export function toRepositoryError(
  error: Pick<PostgrestError, 'code' | 'message'>,
): RepositoryError {
  const { code, message } = error
  if (code === '42501') {
    return new RepositoryError('forbidden', 'You don’t have permission to make this change.')
  }
  if (code === '23505') {
    return new RepositoryError('conflict', 'That already exists.')
  }
  if (['23514', '23502', '23503', '22P02', '22003', '22001', '22007', '22008'].includes(code)) {
    return new RepositoryError('invalid', 'Some of the values aren’t valid.')
  }
  if (code === 'PGRST116') {
    return new RepositoryError('not-found', 'That item no longer exists or can’t be changed.')
  }
  if (!code && /fetch|network/i.test(message)) {
    return new RepositoryError('network', 'Couldn’t reach the server. Check your connection.')
  }
  return new RepositoryError('unknown', message || 'Something went wrong.')
}

function unwrap<R extends { data: unknown; error: PostgrestError | null }>(
  result: R,
): NonNullable<R['data']> {
  if (result.error) throw toRepositoryError(result.error)
  if (result.data === null || result.data === undefined) {
    throw new RepositoryError('not-found', 'Nothing was returned.')
  }
  return result.data as NonNullable<R['data']>
}

export function createSupabaseRepository(client: Client): WeddingRepository {
  /** Reads every row of a table for one wedding, across as many pages as needed. */
  async function fetchAll<T extends Exclude<TableName, 'weddings' | 'planners'>>(
    table: T,
    weddingId: Id,
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    type Row = Database['public']['Tables'][T]['Row']
    // Generic table names defeat the typed query builder; rows are typed on the way out.
    const untyped = client as unknown as SupabaseClient
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const result = await untyped
        .from(table)
        .select('*')
        .eq('wedding_id', weddingId)
        .order('created_at')
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
      const page = unwrap(result) as Row[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  async function setDeletedAt(kind: SoftDeletableKind, id: Id, deletedAt: string | null) {
    const result = await client
      .from(SOFT_DELETE_TABLES[kind])
      .update({ deleted_at: deletedAt })
      .eq('id', id)
      .select('id')
    const rows = unwrap(result)
    if (rows.length === 0) {
      throw new RepositoryError('not-found', 'That item no longer exists or can’t be changed.')
    }
  }

  return {
    async loadSnapshot(slug): Promise<WeddingSnapshot> {
      const { data: weddingRow, error } = await client
        .from('weddings')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw toRepositoryError(error)
      if (!weddingRow) throw new WeddingNotFoundError(slug)

      const [definitions, events, categories, activities, images, links, payments] =
        await Promise.all([
          fetchAll('category_definitions', weddingRow.id),
          fetchAll('events', weddingRow.id),
          fetchAll('event_categories', weddingRow.id),
          fetchAll('activities', weddingRow.id),
          fetchAll('activity_images', weddingRow.id),
          fetchAll('activity_links', weddingRow.id),
          fetchAll('payments', weddingRow.id),
        ])

      return {
        wedding: map.toWedding(weddingRow),
        categoryDefinitions: definitions.map(map.toCategoryDefinition),
        events: events.map(map.toEvent),
        eventCategories: categories.map(map.toEventCategory),
        activities: activities.map(map.toActivity),
        activityImages: images.map(map.toActivityImage),
        activityLinks: links.map(map.toActivityLink),
        payments: payments.map(map.toPayment),
      }
    },

    async updateWedding(id, patch) {
      const row = unwrap(
        await client
          .from('weddings')
          .update(map.weddingPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toWedding(row)
    },

    async createEvent(input) {
      const row = unwrap(
        await client.from('events').insert(map.newEventToRow(input)).select().single(),
      )
      return map.toEvent(row)
    },

    async updateEvent(id, patch) {
      const row = unwrap(
        await client
          .from('events')
          .update(map.eventPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toEvent(row)
    },

    async createCategoryDefinition(input) {
      const row = unwrap(
        await client
          .from('category_definitions')
          .insert(map.newCategoryDefinitionToRow(input))
          .select()
          .single(),
      )
      return map.toCategoryDefinition(row)
    },

    async renameCategoryDefinition(id, name) {
      const row = unwrap(
        await client
          .from('category_definitions')
          .update({ name: name.trim() })
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toCategoryDefinition(row)
    },

    async createEventCategory(input) {
      const row = unwrap(
        await client
          .from('event_categories')
          .insert(map.newEventCategoryToRow(input))
          .select()
          .single(),
      )
      return map.toEventCategory(row)
    },

    async updateEventCategory(id, patch) {
      const row = unwrap(
        await client
          .from('event_categories')
          .update(map.eventCategoryPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toEventCategory(row)
    },

    async createActivity(input) {
      const row = unwrap(
        await client.from('activities').insert(map.newActivityToRow(input)).select().single(),
      )
      return map.toActivity(row)
    },

    async updateActivity(id, patch) {
      const row = unwrap(
        await client
          .from('activities')
          .update(map.activityPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toActivity(row)
    },

    async createPayment(input) {
      const row = unwrap(
        await client.from('payments').insert(map.newPaymentToRow(input)).select().single(),
      )
      return map.toPayment(row)
    },

    async updatePayment(id, patch) {
      const row = unwrap(
        await client
          .from('payments')
          .update(map.paymentPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toPayment(row)
    },

    async createActivityLink(input) {
      const row = unwrap(
        await client
          .from('activity_links')
          .insert(map.newActivityLinkToRow(input))
          .select()
          .single(),
      )
      return map.toActivityLink(row)
    },

    async updateActivityLink(id, patch) {
      const row = unwrap(
        await client
          .from('activity_links')
          .update(map.activityLinkPatchToRow(patch))
          .eq('id', id)
          .select()
          .single(),
      )
      return map.toActivityLink(row)
    },

    softDelete: (kind, id) => setDeletedAt(kind, id, new Date().toISOString()),
    restore: (kind, id) => setDeletedAt(kind, id, null),
  }
}
