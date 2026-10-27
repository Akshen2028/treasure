import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Id, WeddingSnapshot } from '@/domain/types'
import { activityImagePaths, eventCoverPath } from '@/domain/media'
import type { Database } from '@/lib/database.types'
import { randomId } from '@/lib/randomId'

import {
  RepositoryError,
  type SoftDeletableKind,
  WeddingNotFoundError,
  type WeddingRepository,
} from '../repository'
import * as map from './mappers'

type Client = SupabaseClient<Database>
type TableName = keyof Database['public']['Tables']

export const MEDIA_BUCKET = 'wedding-media'

/** Uploaded media never changes in place (new uploads get new paths), so cache it for a year. */
const MEDIA_CACHE_SECONDS = '31536000'

/** Signed media URLs last an hour; the app refreshes them before then. */
export const SIGNED_URL_SECONDS = 3600

const SOFT_DELETE_TABLES = {
  definition: 'category_definitions',
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
  if (code === '23514' && !/violates/.test(message)) {
    // Raised by our own database rules, which use plain-English messages.
    return new RepositoryError('invalid', `${message}.`)
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

  async function upload(path: string, blob: Blob, contentType: string) {
    const { error } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { contentType, cacheControl: MEDIA_CACHE_SECONDS, upsert: false })
    if (error) {
      const forbidden = /row-level security|unauthorized|not authorized/i.test(error.message)
      throw new RepositoryError(
        forbidden ? 'forbidden' : /size|large/i.test(error.message) ? 'invalid' : 'unknown',
        forbidden
          ? 'You don’t have permission to upload photos.'
          : /size|large/i.test(error.message)
            ? 'That photo is too large to upload.'
            : 'The photo couldn’t be uploaded. Please try again.',
      )
    }
  }

  /** Best-effort cleanup; a leftover file is harmless, so failures are ignored. */
  async function removeQuietly(paths: string[]) {
    if (paths.length)
      await client.storage
        .from(MEDIA_BUCKET)
        .remove(paths)
        .catch(() => {})
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

    async loadGuestView(slug, shareKey) {
      const { data, error } = await client.rpc('guest_view', {
        p_slug: slug,
        ...(shareKey ? { p_share_key: shareKey } : {}),
      })
      if (error) throw toRepositoryError(error)
      if (data === null) throw new WeddingNotFoundError(slug)
      return map.fromGuestView(data)
    },

    async searchWeddings(term) {
      const { data, error } = await client.rpc('search_weddings', { q: term })
      if (error) throw toRepositoryError(error)
      return data.map((row) => ({
        name: row.name,
        slug: row.slug,
        // The column is nullable; the generated types don't know that.
        weddingDate: (row.wedding_date as string | null) ?? null,
      }))
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

    async addActivityImage({ weddingId, activityId, image, sortOrder }) {
      const id = randomId()
      const paths = activityImagePaths(
        weddingId,
        activityId,
        id,
        image.full.mimeType,
        image.thumb?.mimeType ?? image.full.mimeType,
      )
      const uploaded: string[] = []
      try {
        await upload(paths.full, image.full.blob, image.full.mimeType)
        uploaded.push(paths.full)
        if (image.thumb) {
          await upload(paths.thumb, image.thumb.blob, image.thumb.mimeType)
          uploaded.push(paths.thumb)
        }
        const row = unwrap(
          await client
            .from('activity_images')
            .insert({
              wedding_id: weddingId,
              activity_id: activityId,
              storage_path: paths.full,
              thumbnail_path: image.thumb ? paths.thumb : null,
              mime_type: image.full.mimeType,
              size_bytes: image.full.blob.size,
              width: image.width,
              height: image.height,
              sort_order: sortOrder ?? 0,
            })
            .select()
            .single(),
        )
        return map.toActivityImage(row)
      } catch (error) {
        await removeQuietly(uploaded)
        throw error
      }
    },

    async setEventCover({ weddingId, eventId, image }) {
      const current = unwrap(
        await client.from('events').select('cover_image_path').eq('id', eventId).single(),
      )
      const previous = current.cover_image_path
      let newPath: string | null = null
      if (image) {
        newPath = eventCoverPath(weddingId, eventId, randomId(), image.full.mimeType)
        await upload(newPath, image.full.blob, image.full.mimeType)
      }
      try {
        const row = unwrap(
          await client
            .from('events')
            .update({ cover_image_path: newPath })
            .eq('id', eventId)
            .select()
            .single(),
        )
        // The old cover is no longer referenced anywhere.
        if (previous && previous !== newPath) await removeQuietly([previous])
        return map.toEvent(row)
      } catch (error) {
        if (newPath) await removeQuietly([newPath])
        throw error
      }
    },

    async signMedia({ audience, slug, shareKey, paths }) {
      if (audience === 'planner') {
        if (paths.length === 0) return {}
        // Storage policies let planners read their own wedding's folder.
        const { data, error } = await client.storage
          .from(MEDIA_BUCKET)
          .createSignedUrls(paths, SIGNED_URL_SECONDS)
        if (error) throw new RepositoryError('unknown', 'Photos couldn’t be loaded.')
        return Object.fromEntries(
          data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
        )
      }
      // Guests can't read storage at all; the media function checks they may view the
      // wedding and signs only the photos the guest view shows.
      const { data, error } = await client.functions.invoke<{ urls: Record<string, string> }>(
        'media',
        { body: { slug, shareKey } },
      )
      if (error || !data) throw new RepositoryError('unknown', 'Photos couldn’t be loaded.')
      return data.urls
    },

    async getShareKey(weddingId) {
      const row = unwrap(
        await client.from('weddings').select('share_key').eq('id', weddingId).single(),
      )
      return row.share_key
    },

    async resetShareKey(weddingId) {
      const { data, error } = await client.rpc('reset_share_key', { p_wedding_id: weddingId })
      if (error) throw toRepositoryError(error)
      return data
    },

    async changeSlug(weddingId, slug) {
      const rows = unwrap(
        await client.from('weddings').update({ slug }).eq('id', weddingId).select('id'),
      )
      if (rows.length === 0) {
        throw new RepositoryError('forbidden', 'You don’t have permission to make this change.')
      }
    },

    async isSlugAvailable(slug) {
      const { data, error } = await client.rpc('slug_available', { p_slug: slug })
      if (error) throw toRepositoryError(error)
      return data
    },

    softDelete: (kind, id) => setDeletedAt(kind, id, new Date().toISOString()),
    restore: (kind, id) => setDeletedAt(kind, id, null),
  }
}
