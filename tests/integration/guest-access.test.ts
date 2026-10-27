/**
 * Visibility, share links and the guest view (PLAN.md §13, phase 1): who can open a wedding,
 * what a guest receives in each mode, search, share-key resets and signed photo URLs.
 * The media tests need the `media` Edge Function deployed (`supabase functions deploy media`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type PreparedImage, type WeddingRepository, WeddingNotFoundError } from '@/data/repository'
import { createSupabaseRepository } from '@/data/supabase/SupabaseRepository'
import { computeGuestFigures } from '@/domain/guestFigures'

import { untyped } from './support/clients'
import { testEnv } from './support/env'
import { createFixture, type Fixture } from './support/fixture'

let f: Fixture
let planner: WeddingRepository
let guest: WeddingRepository
let outsider: WeddingRepository

beforeAll(async () => {
  f = await createFixture()
  planner = createSupabaseRepository(f.plannerClient)
  guest = createSupabaseRepository(f.guest)
  outsider = createSupabaseRepository(f.outsiderClient)
})

afterAll(async () => {
  await f?.cleanup()
})

const DENIED = '42501'

async function setWedding(
  values: { visibility?: 'public' | 'private'; guest_amounts?: 'amounts' | 'percentages' },
  id = f.weddingId,
) {
  const { error } = await f.admin.from('weddings').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}

async function shareKey(id = f.weddingId) {
  const { data } = await f.admin.from('weddings').select('share_key').eq('id', id).single()
  return data!.share_key
}

async function rawGuestView(key: string | null = null) {
  const { data, error } = await f.guest.rpc('guest_view', {
    p_slug: f.weddingSlug,
    ...(key ? { p_share_key: key } : {}),
  })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

beforeEach(async () => {
  await setWedding({ visibility: 'private', guest_amounts: 'amounts' })
})

describe('who can open a wedding', () => {
  it('hides a private wedding without its share key, as if it did not exist', async () => {
    await expect(guest.loadGuestView(f.weddingSlug, null)).rejects.toBeInstanceOf(
      WeddingNotFoundError,
    )
    await expect(
      guest.loadGuestView(f.weddingSlug, '0123456789abcdef0123456789abcdef'),
    ).rejects.toBeInstanceOf(WeddingNotFoundError)
    await expect(outsider.loadGuestView(f.weddingSlug, null)).rejects.toBeInstanceOf(
      WeddingNotFoundError,
    )
  })

  it('opens a private wedding with the right share key', async () => {
    const snapshot = await guest.loadGuestView(f.weddingSlug, await shareKey())
    expect(snapshot.wedding).toMatchObject({ id: f.weddingId, visibility: 'private' })
    expect(snapshot.events.map((e) => e.id)).toContain(f.eventId)
  })

  it('opens a public wedding for anyone', async () => {
    await setWedding({ visibility: 'public' })
    const snapshot = await guest.loadGuestView(f.weddingSlug, null)
    expect(snapshot.wedding.id).toBe(f.weddingId)
  })

  it('lets planners open their own private wedding without the key', async () => {
    const snapshot = await planner.loadGuestView(f.weddingSlug, null)
    expect(snapshot.wedding.id).toBe(f.weddingId)
  })

  it('never sends the share key or plan to guests', async () => {
    const view = await rawGuestView(await shareKey())
    const wedding = view!.wedding as Record<string, unknown>
    expect(wedding).not.toHaveProperty('share_key')
    expect(wedding).not.toHaveProperty('plan')
  })
})

describe('what a guest sees', () => {
  it('leaves out soft-deleted records and everything under a deleted parent', async () => {
    const key = await shareKey()
    await planner.softDelete('payment', f.paymentId)
    let snapshot = await guest.loadGuestView(f.weddingSlug, key)
    expect(snapshot.payments.map((p) => p.id)).not.toContain(f.paymentId)
    expect(snapshot.activities.map((a) => a.id)).toContain(f.activityId)
    await planner.restore('payment', f.paymentId)

    await planner.softDelete('event', f.eventId)
    snapshot = await guest.loadGuestView(f.weddingSlug, key)
    expect(snapshot.events.map((e) => e.id)).not.toContain(f.eventId)
    expect(snapshot.eventCategories.map((c) => c.id)).not.toContain(f.eventCategoryId)
    expect(snapshot.activities.map((a) => a.id)).not.toContain(f.activityId)
    expect(snapshot.payments.map((p) => p.id)).not.toContain(f.paymentId)
    await planner.restore('event', f.eventId)
  })

  it('shows real amounts in amounts mode', async () => {
    const snapshot = await guest.loadGuestView(f.weddingSlug, await shareKey())
    const activity = snapshot.activities.find((a) => a.id === f.activityId)!
    expect(activity.budgetCents).toBe(150_000)
    expect(snapshot.guestFigures).toBeNull()
  })

  it('sends no amounts in percentage mode, only figures matching the domain rules', async () => {
    await setWedding({ guest_amounts: 'percentages' })
    const key = await shareKey()
    const raw = await rawGuestView(key)

    // Every money column is blanked, whatever its table.
    const moneyValues: unknown[] = []
    const collect = (value: unknown, field?: string) => {
      if (Array.isArray(value)) value.forEach((v) => collect(v))
      else if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) {
          if (k === 'figures') continue
          collect(v, k)
        }
      else if (field?.endsWith('_cents')) moneyValues.push(value)
    }
    collect(raw)
    expect(moneyValues.length).toBeGreaterThan(0)
    expect(moneyValues.every((v) => v === 0 || v === null)).toBe(true)
    const payments = raw!.payments as Array<{ note: string }>
    expect(payments.every((p) => p.note === '')).toBe(true)

    // The figures are exactly what the app's own budget logic gives for the real data.
    const real = await planner.loadSnapshot(f.weddingSlug)
    const view = await guest.loadGuestView(f.weddingSlug, key)
    expect(view.guestFigures).toEqual(computeGuestFigures(real))
  })

  it('computes percentage figures in manual mode too', async () => {
    await setWedding({ guest_amounts: 'percentages' })
    await planner.updateWedding(f.weddingId, { budgetMode: 'manual', manualBudgetCents: 600_000 })
    try {
      const real = await planner.loadSnapshot(f.weddingSlug)
      const view = await guest.loadGuestView(f.weddingSlug, await shareKey())
      expect(view.guestFigures).toEqual(computeGuestFigures(real))
    } finally {
      await planner.updateWedding(f.weddingId, { budgetMode: 'auto' })
    }
  })
})

describe('settings and share keys', () => {
  it('lets planners change visibility and guest amounts', async () => {
    const wedding = await planner.updateWedding(f.weddingId, {
      visibility: 'public',
      guestAmounts: 'percentages',
    })
    expect(wedding).toMatchObject({ visibility: 'public', guestAmounts: 'percentages' })
  })

  it('refuses direct changes to the share key or plan, even from planners', async () => {
    for (const values of [{ share_key: '0123456789abcdef0123456789abcdef' }, { plan: 'free' }]) {
      const { error } = await untyped(f.plannerClient)
        .from('weddings')
        .update(values)
        .eq('id', f.weddingId)
      expect(error?.code).toBe(DENIED)
    }
  })

  it('refuses settings changes from outsiders', async () => {
    const { data } = await f.outsiderClient
      .from('weddings')
      .update({ visibility: 'public' })
      .eq('id', f.weddingId)
      .select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('resetting the share key stops old links working', async () => {
    const oldKey = await shareKey()
    const newKey = await planner.resetShareKey(f.weddingId)
    expect(newKey).toMatch(/^[0-9a-f]{32}$/)
    expect(newKey).not.toBe(oldKey)
    await expect(guest.loadGuestView(f.weddingSlug, oldKey)).rejects.toBeInstanceOf(
      WeddingNotFoundError,
    )
    expect((await guest.loadGuestView(f.weddingSlug, newKey)).wedding.id).toBe(f.weddingId)
  })

  it('only planners of the wedding can reset its key', async () => {
    const asOutsider = await f.outsiderClient.rpc('reset_share_key', {
      p_wedding_id: f.weddingId,
    })
    expect(asOutsider.error?.code).toBe(DENIED)
    const asGuest = await f.guest.rpc('reset_share_key', { p_wedding_id: f.weddingId })
    expect(asGuest.error).not.toBeNull()
    const asPlanner = await f.plannerClient.rpc('reset_share_key', {
      p_wedding_id: f.otherWeddingId,
    })
    expect(asPlanner.error?.code).toBe(DENIED)
  })

  it('lets planners read their own share key, and nobody else', async () => {
    expect(await planner.getShareKey(f.weddingId)).toBe(await shareKey())
    await expect(outsider.getShareKey(f.weddingId)).rejects.toThrow()
    await expect(planner.getShareKey(f.otherWeddingId)).rejects.toThrow()
    const { error } = await f.guest.from('weddings').select('share_key').eq('id', f.weddingId)
    expect(error?.code).toBe(DENIED)
  })

  it('lets planners change the web address; the old one stops working', async () => {
    const moved = `${f.weddingSlug}-moved`
    await setWedding({ visibility: 'public' })
    try {
      await planner.changeSlug(f.weddingId, moved)
      expect((await guest.loadGuestView(moved, null)).wedding.id).toBe(f.weddingId)
      await expect(guest.loadGuestView(f.weddingSlug, null)).rejects.toBeInstanceOf(
        WeddingNotFoundError,
      )
    } finally {
      await f.admin.from('weddings').update({ slug: f.weddingSlug }).eq('id', f.weddingId)
    }
  })

  it('refuses a web address that is taken or malformed', async () => {
    const { data: other } = await f.admin
      .from('weddings')
      .select('slug')
      .eq('id', f.otherWeddingId)
      .single()
    await expect(planner.changeSlug(f.weddingId, other!.slug)).rejects.toMatchObject({
      reason: 'conflict',
    })
    for (const bad of ['Has Caps', '-leading', 'x'.repeat(64)]) {
      await expect(planner.changeSlug(f.weddingId, bad)).rejects.toMatchObject({
        reason: 'invalid',
      })
    }
  })

  it('tells signed-in users whether a web address is free, and nothing more', async () => {
    const { data: other } = await f.admin
      .from('weddings')
      .select('slug')
      .eq('id', f.otherWeddingId)
      .single()
    expect(await planner.isSlugAvailable(other!.slug)).toBe(false)
    expect(await outsider.isSlugAvailable(f.weddingSlug)).toBe(false)
    expect(await planner.isSlugAvailable(`${f.weddingSlug}-free`)).toBe(true)
    expect(await planner.isSlugAvailable('Not Valid')).toBe(false)
    const { error } = await f.guest.rpc('slug_available', { p_slug: f.weddingSlug })
    expect(error).not.toBeNull()
  })

  it('refuses web address changes from outsiders and guests', async () => {
    await expect(outsider.changeSlug(f.weddingId, 'test-hijacked')).rejects.toMatchObject({
      reason: 'forbidden',
    })
    await expect(guest.changeSlug(f.weddingId, 'test-hijacked')).rejects.toMatchObject({
      reason: 'forbidden',
    })
    const { data } = await f.admin.from('weddings').select('slug').eq('id', f.weddingId).single()
    expect(data!.slug).toBe(f.weddingSlug)
  })

  it('keeps internal helpers away from the public key', async () => {
    const helpers = [
      ['viewable_wedding_id', { p_slug: f.weddingSlug, p_share_key: null }],
      ['budget_share', { amount: 1, total: 2 }],
      ['new_share_key', {}],
    ] as const
    for (const [name, args] of helpers) {
      const { error } = await untyped(f.guest).rpc(name, args)
      expect(error, name).not.toBeNull()
    }
  })
})

describe('search', () => {
  const search = async (q: string) => {
    const { data, error } = await f.guest.rpc('search_weddings', { q })
    if (error) throw new Error(error.message)
    return data.map((w) => w.slug)
  }

  it('finds public weddings and never private ones', async () => {
    expect(await search(f.weddingSlug)).not.toContain(f.weddingSlug)
    await setWedding({ visibility: 'public' })
    expect(await search(f.weddingSlug)).toContain(f.weddingSlug)
  })

  it('needs at least 3 characters and returns at most 10 results', async () => {
    await setWedding({ visibility: 'public' })
    expect(await search('te')).toEqual([])
    expect((await search('test-')).length).toBeLessThanOrEqual(10)
  })

  it('treats wildcards literally', async () => {
    await setWedding({ visibility: 'public' })
    expect(await search('%%%')).toEqual([])
    expect(await search('___')).toEqual([])
  })
})

describe('photos for guests (media function)', () => {
  // Smallest valid PNG: 1×1 transparent pixel.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  )
  const image = (): PreparedImage => ({
    full: { blob: new Blob([PNG], { type: 'image/png' }), mimeType: 'image/png' },
    thumb: null,
    width: 1,
    height: 1,
  })

  async function callMedia(body: unknown) {
    const { url, publishableKey } = testEnv()
    return fetch(`${url}/functions/v1/media`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('signs only the photos the guest view shows, after the same access check', async () => {
    const shown = await planner.addActivityImage({
      weddingId: f.weddingId,
      activityId: f.activityId,
      image: image(),
    })
    const hidden = await planner.addActivityImage({
      weddingId: f.weddingId,
      activityId: f.activityId,
      image: image(),
    })
    await planner.softDelete('image', hidden.id)

    // Private, no key: refused exactly like a missing wedding.
    expect((await callMedia({ slug: f.weddingSlug })).status).toBe(404)
    expect((await callMedia({ slug: 'test-does-not-exist' })).status).toBe(404)
    expect((await callMedia({ slug: f.weddingSlug, shareKey: 'nope' })).status).toBe(400)

    const urls = await guest.signMedia({
      audience: 'guest',
      slug: f.weddingSlug,
      shareKey: await shareKey(),
      paths: [],
    })
    expect(Object.keys(urls)).toContain(shown.storagePath)
    expect(Object.keys(urls)).not.toContain(hidden.storagePath)
    expect((await fetch(urls[shown.storagePath]!)).status).toBe(200)
  })
})
