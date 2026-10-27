/**
 * Abuse limits per wedding (PLAN.md §13, step 18): record and photo-file caps, wedding name
 * length, and web address rules. The caps count soft-deleted rows too.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { WeddingRepository } from '@/data/repository'
import { createSupabaseRepository } from '@/data/supabase/SupabaseRepository'

import { untyped } from './support/clients'
import { createFixture, type Fixture, MEDIA_BUCKET } from './support/fixture'

let f: Fixture
let planner: WeddingRepository

beforeAll(async () => {
  f = await createFixture({ signIn: ['planner'] })
  planner = createSupabaseRepository(f.plannerClient)
})

afterAll(async () => {
  await f?.cleanup()
})

const CHECK = '23514'

async function count(table: 'events' | 'payments' | 'category_definitions', weddingId: string) {
  const { count: n } = await f.admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('wedding_id', weddingId)
  return n ?? 0
}

/** Fills a table to `limit` rows for the planner's wedding, as admin (bulk, one statement). */
async function fillTo<T extends object>(
  table: 'events' | 'payments' | 'category_definitions' | 'activity_images',
  limit: number,
  row: (n: number) => T,
) {
  const { count: existing } = await f.admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('wedding_id', f.weddingId)
  const rows = Array.from({ length: limit - (existing ?? 0) }, (_, n) => row(n))
  const { error } = await untyped(f.admin).from(table).insert(rows)
  expect(error).toBeNull()
}

describe('record caps', () => {
  it('stops a wedding at 50 events, counting deleted ones, and refuses a batch over the cap', async () => {
    await fillTo('events', 49, (n) => ({ wedding_id: f.weddingId, name: `Cap Event ${n}` }))
    await planner.createEvent({ weddingId: f.weddingId, name: 'The 50th' })

    const { data: one } = await f.admin
      .from('events')
      .select('id')
      .eq('wedding_id', f.weddingId)
      .eq('name', 'The 50th')
      .single()
    await f.plannerClient
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', one!.id)

    await expect(
      planner.createEvent({ weddingId: f.weddingId, name: 'One too many' }),
    ).rejects.toMatchObject({ reason: 'invalid', message: 'A wedding can have up to 50 events.' })
    expect(await count('events', f.weddingId)).toBe(50)

    // Another wedding is unaffected.
    const other = await f.admin
      .from('events')
      .insert({ wedding_id: f.otherWeddingId, name: 'Elsewhere' })
    expect(other.error).toBeNull()
  })

  it('refuses a whole batch that would go over the cap', async () => {
    await fillTo('category_definitions', 99, (n) => ({
      wedding_id: f.weddingId,
      name: `Cap Category ${n}`,
    }))
    const { error } = await f.plannerClient.from('category_definitions').insert([
      { wedding_id: f.weddingId, name: 'Batch A' },
      { wedding_id: f.weddingId, name: 'Batch B' },
    ])
    expect(error).toMatchObject({ code: CHECK, message: 'A wedding can have up to 100 categories' })
    expect(await count('category_definitions', f.weddingId)).toBe(99)
  })

  it('caps payments at 5,000, even for the service role', async () => {
    await fillTo('payments', 5000, (n) => ({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      amount_cents: 100 + n,
      paid_on: '2026-09-01',
    }))
    const { error } = await f.admin.from('payments').insert({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      amount_cents: 100,
      paid_on: '2026-09-01',
    })
    expect(error).toMatchObject({ code: CHECK, message: 'A wedding can have up to 5,000 payments' })
  })

  it('caps photos at 300', async () => {
    await fillTo('activity_images', 300, (n) => ({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      storage_path: `${f.weddingId}/activities/cap/${n}.webp`,
      mime_type: 'image/webp',
      size_bytes: 1,
    }))
    const { error } = await f.plannerClient.from('activity_images').insert({
      wedding_id: f.weddingId,
      activity_id: f.activityId,
      storage_path: `${f.weddingId}/activities/cap/extra.webp`,
      mime_type: 'image/webp',
      size_bytes: 1,
    })
    expect(error).toMatchObject({ code: CHECK, message: 'A wedding can have up to 300 photos' })
  })
})

// Smallest valid PNG: 1×1 transparent pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

describe('photo file cap', () => {
  it('refuses planner uploads once the wedding folder holds 800 files', async () => {
    const upload = (client: Fixture['admin'], name: string) =>
      client.storage
        .from(MEDIA_BUCKET)
        .upload(`${f.weddingId}/activities/cap/${name}.png`, PNG, { contentType: 'image/png' })

    expect((await upload(f.plannerClient, 'first')).error).toBeNull()
    const names = Array.from({ length: 799 }, (_, n) => `fill-${n}`)
    for (let i = 0; i < names.length; i += 40) {
      const results = await Promise.all(names.slice(i, i + 40).map((n) => upload(f.admin, n)))
      expect(results.map((r) => r.error)).toEqual(results.map(() => null))
    }
    expect((await upload(f.plannerClient, 'over')).error).not.toBeNull()
  }, 120_000)
})

describe('wedding names', () => {
  it('allows names up to 100 characters', async () => {
    await planner.updateWedding(f.weddingId, { name: 'n'.repeat(100) })
    await expect(
      planner.updateWedding(f.weddingId, { name: 'n'.repeat(101) }),
    ).rejects.toMatchObject({ reason: 'invalid' })
    await planner.updateWedding(f.weddingId, { name: 'Integration Test Wedding' })
  })
})

describe('web addresses', () => {
  it.each(['ab', 'alex-', 'alex--sam'])('refuses the malformed address %j', async (slug) => {
    await expect(planner.changeSlug(f.weddingId, slug)).rejects.toMatchObject({
      reason: 'invalid',
    })
    expect(await planner.isSlugAvailable(slug)).toBe(false)
  })

  it.each(['admin', 'terms', `test-${'fuck'}-co`])(
    'refuses the blocked address %j',
    async (slug) => {
      await expect(planner.changeSlug(f.weddingId, slug)).rejects.toMatchObject({
        reason: 'invalid',
        message: 'That web address isn’t available.',
      })
      expect(await planner.isSlugAvailable(slug)).toBe(false)
    },
  )

  it('refuses blocked addresses for new weddings too, even from the service role', async () => {
    // Test-prefixed, so the global sweep removes it if the rule is ever missing.
    const { error } = await f.admin
      .from('weddings')
      .insert({ slug: 'test-kkk-limits', name: 'Test Blocked' })
    expect(error?.code).toBe(CHECK)
  })

  it('still allows ordinary addresses that contain a reserved word', async () => {
    expect(await planner.isSlugAvailable(`${f.weddingSlug}-terms`)).toBe(true)
  })
})
