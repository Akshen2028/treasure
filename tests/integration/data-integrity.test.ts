/**
 * Database constraints that protect financial correctness, independent of the app's checks.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createFixture, type Fixture } from './support/fixture'

let f: Fixture

beforeAll(async () => {
  f = await createFixture()
})

afterAll(async () => {
  await f?.cleanup()
})

const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'

describe('new weddings', () => {
  it('start with the seven default categories', async () => {
    const { data } = await f.guest
      .from('category_definitions')
      .select('name, is_default')
      .eq('wedding_id', f.weddingId)
      .eq('is_default', true)
      .order('sort_order')
    expect(data?.map((d) => d.name)).toEqual([
      'Food',
      'Decor',
      'Entertainment',
      'Venue',
      'Outfits',
      'Photographer',
      'Videographer',
    ])
  })

  it('default to auto budget mode', async () => {
    const { data } = await f.admin
      .from('weddings')
      .select('budget_mode, manual_budget_cents')
      .eq('id', f.otherWeddingId)
      .single()
    expect(data).toEqual({ budget_mode: 'auto', manual_budget_cents: 0 })
  })
})

describe('shared categories', () => {
  it('are unique per wedding, ignoring case and spaces', async () => {
    const { error } = await f.plannerClient
      .from('category_definitions')
      .insert({ wedding_id: f.weddingId, name: '  decor ' })
    expect(error?.code).toBe(UNIQUE_VIOLATION)
  })

  it('appear at most once among an event’s active categories', async () => {
    const { error } = await f.plannerClient.from('event_categories').insert({
      wedding_id: f.weddingId,
      event_id: f.eventId,
      category_definition_id: f.categoryDefinitionId,
    })
    expect(error?.code).toBe(UNIQUE_VIOLATION)
  })

  it('can be re-added after deletion, and the old one then cannot be restored as a duplicate', async () => {
    const event = await f.plannerClient
      .from('events')
      .insert({ wedding_id: f.weddingId, name: 'Haldi' })
      .select('id')
      .single()
    const add = () =>
      f.plannerClient
        .from('event_categories')
        .insert({
          wedding_id: f.weddingId,
          event_id: event.data!.id,
          category_definition_id: f.categoryDefinitionId,
        })
        .select('id')
        .single()

    const first = await add()
    await f.plannerClient
      .from('event_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', first.data!.id)

    const second = await add()
    expect(second.error).toBeNull()

    const restore = await f.plannerClient
      .from('event_categories')
      .update({ deleted_at: null })
      .eq('id', first.data!.id)
    expect(restore.error?.code).toBe(UNIQUE_VIOLATION)
  })
})

describe('money and data constraints', () => {
  it.each([
    ['negative activity budget', 'activities', { budget_cents: -1 }],
    ['negative actual cost', 'activities', { actual_cost_cents: -1 }],
    ['fractional cents are not representable', 'activities', { budget_cents: 10.5 }],
    ['budget above the maximum', 'activities', { budget_cents: 100_000_000_000 }],
    ['empty activity name', 'activities', { name: '   ' }],
    ['zero payment', 'payments', { amount_cents: 0 }],
    ['negative payment', 'payments', { amount_cents: -500 }],
  ] as const)('rejects %s', async (_, table, change) => {
    const id = table === 'payments' ? f.paymentId : f.activityId
    const { error } = await f.plannerClient.from(table).update(change).eq('id', id)
    expect(error).not.toBeNull()
  })

  it('accepts a null actual cost', async () => {
    const { error } = await f.plannerClient
      .from('activities')
      .update({ actual_cost_cents: null })
      .eq('id', f.activityId)
    expect(error).toBeNull()
  })

  it.each(['javascript:alert(1)', 'ftp://example.com', 'example.com', 'https://has space.com'])(
    'rejects the link %j',
    async (url) => {
      const { error } = await f.plannerClient
        .from('activity_links')
        .insert({ wedding_id: f.weddingId, activity_id: f.activityId, url })
      expect(error?.code).toBe(CHECK_VIOLATION)
    },
  )

  it('rejects media paths outside the wedding’s folder', async () => {
    const { error } = await f.plannerClient.from('activity_images').insert({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      storage_path: `${f.otherWeddingId}/activities/x/photo.webp`,
      mime_type: 'image/webp',
      size_bytes: 1000,
    })
    expect(error?.code).toBe(CHECK_VIOLATION)

    const cover = await f.plannerClient
      .from('events')
      .update({ cover_image_path: 'elsewhere/cover.webp' })
      .eq('id', f.eventId)
    expect(cover.error?.code).toBe(CHECK_VIOLATION)
  })

  it('rejects unsupported image types', async () => {
    const { error } = await f.plannerClient.from('activity_images').insert({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      storage_path: `${f.weddingId}/activities/${f.activityId}/file.svg`,
      mime_type: 'image/svg+xml',
      size_bytes: 1000,
    })
    expect(error?.code).toBe(CHECK_VIOLATION)
  })

  it('keeps updated_at current automatically', async () => {
    const before = await f.admin.from('events').select('updated_at').eq('id', f.eventId).single()
    await new Promise((r) => setTimeout(r, 20))
    await f.plannerClient.from('events').update({ location: 'Mississauga' }).eq('id', f.eventId)
    const after = await f.admin.from('events').select('updated_at').eq('id', f.eventId).single()
    expect(Date.parse(after.data!.updated_at)).toBeGreaterThan(Date.parse(before.data!.updated_at))
  })
})

describe('restoring records', () => {
  it('restores a payment exactly once, without duplicating it', async () => {
    const countActive = async () =>
      (
        await f.guest
          .from('payments')
          .select('id')
          .eq('activity_id', f.activityId)
          .is('deleted_at', null)
      ).data?.length

    const before = await countActive()
    await f.plannerClient
      .from('payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', f.paymentId)
    expect(await countActive()).toBe(before! - 1)

    await f.plannerClient.from('payments').update({ deleted_at: null }).eq('id', f.paymentId)
    await f.plannerClient.from('payments').update({ deleted_at: null }).eq('id', f.paymentId)
    expect(await countActive()).toBe(before)
  })

  it('leaves children untouched when a parent is deleted and restored', async () => {
    const stamp = new Date().toISOString()
    await f.plannerClient.from('events').update({ deleted_at: stamp }).eq('id', f.eventId)

    const child = await f.admin
      .from('activities')
      .select('deleted_at')
      .eq('id', f.activityId)
      .single()
    expect(child.data?.deleted_at).toBeNull()

    await f.plannerClient.from('events').update({ deleted_at: null }).eq('id', f.eventId)
    const event = await f.guest.from('events').select('id').eq('id', f.eventId)
    expect(event.data).toHaveLength(1)
  })
})
