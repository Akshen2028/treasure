/**
 * Proves guest, outsider and planner permissions are enforced by the database itself,
 * by calling the Supabase API directly with the public key, exactly as an attacker could.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { untyped } from './support/clients'
import { createFixture, type Fixture } from './support/fixture'

let f: Fixture

beforeAll(async () => {
  f = await createFixture()
})

afterAll(async () => {
  await f?.cleanup()
})

/** Postgres "insufficient privilege", returned for missing grants and RLS violations. */
const DENIED = '42501'

const SOFT_DELETABLE = [
  'events',
  'event_categories',
  'activities',
  'activity_images',
  'activity_links',
  'payments',
] as const

/** A valid new row for each table, inside the given wedding. */
function newRow(table: string, weddingId: string): Record<string, unknown> {
  const rows: Record<string, Record<string, unknown>> = {
    category_definitions: { wedding_id: weddingId, name: `Custom ${crypto.randomUUID()}` },
    events: { wedding_id: weddingId, name: 'Sneaky Event' },
    activities: { wedding_id: weddingId, event_category_id: f.eventCategoryId, name: 'Sneaky' },
    activity_links: {
      wedding_id: weddingId,
      activity_id: f.activityId,
      url: 'https://example.com/quote',
    },
    payments: {
      wedding_id: weddingId,
      activity_id: f.activityId,
      amount_cents: 100,
      paid_on: '2026-10-01',
    },
  }
  const row = rows[table]
  if (!row) throw new Error(`No sample row for ${table}`)
  return row
}

async function eventName(id: string) {
  const { data } = await f.admin.from('events').select('name').eq('id', id).single()
  return data?.name as string
}

describe('guests (public key, no session)', () => {
  it('cannot read any wedding table directly (only through guest_view)', async () => {
    for (const table of ['weddings', ...SOFT_DELETABLE, 'category_definitions']) {
      const { data, error } = await untyped(f.guest).from(table).select('id').limit(1)
      expect(error?.code, table).toBe(DENIED)
      expect(data, table).toBeNull()
    }
  })

  it.each(['category_definitions', 'events', 'activities', 'activity_links', 'payments'])(
    'cannot insert into %s',
    async (table) => {
      const { error } = await untyped(f.guest).from(table).insert(newRow(table, f.weddingId))
      expect(error?.code).toBe(DENIED)
    },
  )

  it('cannot update anything', async () => {
    const { error } = await f.guest.from('events').update({ name: 'Hacked' }).eq('id', f.eventId)
    expect(error?.code).toBe(DENIED)

    const wedding = await f.guest
      .from('weddings')
      .update({ budget_mode: 'manual' })
      .eq('id', f.weddingId)
    expect(wedding.error?.code).toBe(DENIED)
    expect(await eventName(f.eventId)).toBe('Main Reception')
  })

  it('cannot soft-delete', async () => {
    const { error } = await f.guest
      .from('payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', f.paymentId)
    expect(error?.code).toBe(DENIED)
  })

  it('cannot hard-delete', async () => {
    const { error } = await f.guest.from('events').delete().eq('id', f.eventId)
    expect(error?.code).toBe(DENIED)
  })

  it('cannot see planner memberships', async () => {
    const { data, error } = await f.guest.from('planners').select('*')
    expect(error?.code ?? (data?.length === 0 ? 'empty' : 'visible')).not.toBe('visible')
  })

  it('cannot call admin-only operations with the public key', async () => {
    const { error } = await f.guest.auth.admin.listUsers()
    expect(error).not.toBeNull()
  })
})

describe('signed-in users who are not planners', () => {
  it('cannot read another wedding’s rows, even public ones', async () => {
    await f.admin.from('weddings').update({ visibility: 'public' }).eq('id', f.weddingId)
    try {
      for (const table of ['weddings', ...SOFT_DELETABLE, 'category_definitions']) {
        const column = table === 'weddings' ? 'id' : 'wedding_id'
        const { data, error } = await untyped(f.outsiderClient)
          .from(table)
          .select('id')
          .eq(column, f.weddingId)
        expect(error, table).toBeNull()
        expect(data, table).toEqual([])
      }
    } finally {
      await f.admin.from('weddings').update({ visibility: 'private' }).eq('id', f.weddingId)
    }
  })

  it.each(['category_definitions', 'events', 'activities', 'activity_links', 'payments'])(
    'cannot insert into %s',
    async (table) => {
      const { error } = await untyped(f.outsiderClient)
        .from(table)
        .insert(newRow(table, f.weddingId))
      expect(error?.code).toBe(DENIED)
    },
  )

  it('cannot update: rows are filtered out and nothing changes', async () => {
    const { data, error } = await f.outsiderClient
      .from('events')
      .update({ name: 'Hacked' })
      .eq('id', f.eventId)
      .select()
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(await eventName(f.eventId)).toBe('Main Reception')
  })

  it('cannot change wedding settings', async () => {
    const { data } = await f.outsiderClient
      .from('weddings')
      .update({ budget_mode: 'manual' })
      .eq('id', f.weddingId)
      .select()
    expect(data).toEqual([])
  })

  it('cannot make themselves a planner', async () => {
    const { error } = await f.outsiderClient
      .from('planners')
      .insert({ user_id: f.outsider.id, wedding_id: f.weddingId })
    expect(error?.code).toBe(DENIED)
  })

  it('cannot hard-delete', async () => {
    const { error } = await f.outsiderClient.from('payments').delete().eq('id', f.paymentId)
    expect(error?.code).toBe(DENIED)
  })
})

describe('planners', () => {
  it('can see their own membership', async () => {
    const { data } = await f.plannerClient.from('planners').select('wedding_id')
    expect(data).toEqual([{ wedding_id: f.weddingId }])
  })

  it('can create and edit records in their wedding', async () => {
    const created = await f.plannerClient
      .from('events')
      .insert({ wedding_id: f.weddingId, name: 'Sangeet', location: 'Toronto' })
      .select('id, name')
      .single()
    expect(created.error).toBeNull()

    const updated = await f.plannerClient
      .from('events')
      .update({ name: 'Sangeet Night' })
      .eq('id', created.data!.id)
      .select('name')
      .single()
    expect(updated.data?.name).toBe('Sangeet Night')
  })

  it.each(['category_definitions', 'activities', 'activity_links', 'payments'])(
    'can insert into %s',
    async (table) => {
      const { error } = await untyped(f.plannerClient)
        .from(table)
        .insert(newRow(table, f.weddingId))
      expect(error).toBeNull()
    },
  )

  // Changing the slug is allowed since step 15; see guest-access.test.ts.
  it('can change wedding settings', async () => {
    const mode = await f.plannerClient
      .from('weddings')
      .update({ budget_mode: 'manual', manual_budget_cents: 5_000_000 })
      .eq('id', f.weddingId)
      .select('budget_mode')
      .single()
    expect(mode.data?.budget_mode).toBe('manual')
  })

  it('cannot hard-delete, even their own records', async () => {
    const { error } = await f.plannerClient.from('payments').delete().eq('id', f.paymentId)
    expect(error?.code).toBe(DENIED)
    const { data } = await f.admin.from('payments').select('id').eq('id', f.paymentId)
    expect(data).toHaveLength(1)
  })

  it('cannot write to a wedding they do not plan', async () => {
    const insert = await f.plannerClient
      .from('events')
      .insert({ wedding_id: f.otherWeddingId, name: 'Intruder' })
    expect(insert.error?.code).toBe(DENIED)

    const update = await f.plannerClient
      .from('events')
      .update({ name: 'Hacked' })
      .eq('id', f.otherEventId)
      .select()
    expect(update.data).toEqual([])
  })

  it('cannot move a record into another wedding', async () => {
    const { error } = await f.plannerClient
      .from('events')
      .update({ wedding_id: f.otherWeddingId })
      .eq('id', f.eventId)
    expect(error).not.toBeNull()
  })

  it('cannot attach a child to a parent in another wedding', async () => {
    const { error } = await f.plannerClient.from('payments').insert({
      wedding_id: f.weddingId,
      activity_id: f.otherActivityId,
      amount_cents: 100,
      paid_on: '2026-10-01',
    })
    expect(error).not.toBeNull()
  })

  it('cannot add planners', async () => {
    const { error } = await f.plannerClient
      .from('planners')
      .insert({ user_id: f.outsider.id, wedding_id: f.weddingId })
    expect(error?.code).toBe(DENIED)
  })
})

describe('soft deletion visibility', () => {
  it('hides soft-deleted rows from guests and shows them to planners', async () => {
    const link = await f.plannerClient
      .from('activity_links')
      .insert({
        wedding_id: f.weddingId,
        activity_id: f.activityId,
        url: 'https://example.com/to-delete',
        label: 'To delete',
      })
      .select('id')
      .single()
    const id = link.data!.id as string

    const removed = await f.plannerClient
      .from('activity_links')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    expect(removed.data).toHaveLength(1)

    const asOutsider = await f.outsiderClient.from('activity_links').select('id').eq('id', id)
    expect(asOutsider.data).toEqual([])
    const asPlanner = await f.plannerClient.from('activity_links').select('id').eq('id', id)
    expect(asPlanner.data).toHaveLength(1)

    const restored = await f.plannerClient
      .from('activity_links')
      .update({ deleted_at: null })
      .eq('id', id)
      .select('id')
    expect(restored.data).toHaveLength(1)
  })
})
