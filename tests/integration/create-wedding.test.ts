/**
 * One-step wedding creation (PLAN.md §13, phase 2): create_my_wedding() gives a signed-in user
 * one wedding with a unique slug and makes them its planner; nobody else can create weddings.
 */
import { randomBytes, randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { slugify } from '@/domain/slug'

import { adminClient, type Client, guestClient, signedInClient } from './support/clients'
import { TEST_EMAIL_DOMAIN } from './support/env'

const DENIED = '42501'
const DUPLICATE = '23505'
const INVALID = '22023'

const admin = adminClient()
const runId = randomUUID().slice(0, 8)
const userIds: string[] = []

/** A fresh signed-in account with no wedding. */
async function newUser(role: string): Promise<{ id: string; client: Client }> {
  const email = `${role}-${runId}${TEST_EMAIL_DOMAIN}`
  const password = randomBytes(24).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Could not create ${role}: ${error?.message}`)
  userIds.push(data.user.id)
  return { id: data.user.id, client: await signedInClient(email) }
}

// "Test …" names give test- slugs, so a crashed run's weddings are swept like other test data.
const NAME = `Test Alex & Sam ${runId}`
const SLUG = `test-alex-sam-${runId}`

let first: { id: string; client: Client }
let second: { id: string; client: Client }

beforeAll(async () => {
  ;[first, second] = await Promise.all([newUser('creator'), newUser('namesake')])
})

afterAll(async () => {
  await admin.from('weddings').delete().like('slug', `test-%${runId}%`)
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)))
})

describe('create_my_wedding', () => {
  it('lets a new account see that it plans no wedding yet, without an error', async () => {
    // The app keeps such a session and shows "Create your wedding" (plannerVerification.ts).
    const newcomer = await newUser('newcomer')
    const { data, error } = await newcomer.client
      .from('planners')
      .select('wedding_id, weddings!inner(slug)')
      .limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('creates a private wedding with a slug from the names and makes the caller its planner', async () => {
    const { data, error } = await first.client.rpc('create_my_wedding', {
      p_name: `  ${NAME}  `,
      p_wedding_date: '2027-06-12',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({
      slug: SLUG,
      name: NAME,
      wedding_date: '2027-06-12',
      visibility: 'private',
      guest_amounts: 'amounts',
      plan: 'free',
    })
    const weddingId = data!.id

    const [membership, categories, update] = await Promise.all([
      admin.from('planners').select('user_id').eq('wedding_id', weddingId),
      first.client.from('category_definitions').select('id').eq('wedding_id', weddingId),
      first.client
        .from('weddings')
        .update({ guest_amounts: 'percentages' })
        .eq('id', weddingId)
        .select('id'),
    ])
    expect(membership.data).toEqual([{ user_id: first.id }])
    expect(categories.data?.length).toBeGreaterThan(0)
    expect(update.data).toHaveLength(1)
  })

  it('refuses a second wedding for the same account', async () => {
    const { error } = await first.client.rpc('create_my_wedding', { p_name: `Test Again ${runId}` })
    expect(error?.code).toBe(DUPLICATE)
    const { data } = await admin.from('planners').select('wedding_id').eq('user_id', first.id)
    expect(data).toHaveLength(1)
  })

  it('numbers the slug when the names are already taken', async () => {
    const { data, error } = await second.client.rpc('create_my_wedding', { p_name: NAME })
    expect(error).toBeNull()
    expect(data?.slug).toBe(`${SLUG}-2`)
  })

  it('creates only one wedding when the same account calls twice at once', async () => {
    const racer = await newUser('racer')
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        racer.client.rpc('create_my_wedding', { p_name: `Test Race ${n} ${runId}` }),
      ),
    )
    expect(results.filter((r) => r.error === null)).toHaveLength(1)
    expect(results.filter((r) => r.error?.code === DUPLICATE)).toHaveLength(2)
  })

  it.each([
    ['blank', '   '],
    ['too long', 'x'.repeat(201)],
  ])('rejects a %s name', async (_label, name) => {
    const user = await newUser(`invalid-${name.length}`)
    const { error } = await user.client.rpc('create_my_wedding', { p_name: name })
    expect(error?.code).toBe(INVALID)
  })

  it('refuses guests', async () => {
    const { error } = await guestClient().rpc('create_my_wedding', {
      p_name: `Test Guest ${runId}`,
    })
    expect(error?.code).toBe(DENIED)
  })
})

describe('direct inserts stay closed', () => {
  it('refuses a signed-in user inserting a wedding or a planner row', async () => {
    const user = await newUser('direct')
    const wedding = await user.client
      .from('weddings')
      .insert({ slug: `test-direct-${runId}`, name: 'Test Direct' })
    expect(wedding.error?.code).toBe(DENIED)

    const { data: existing } = await admin.from('weddings').select('id').eq('slug', SLUG).single()
    const planner = await user.client
      .from('planners')
      .insert({ user_id: user.id, wedding_id: existing!.id })
    expect(planner.error?.code).toBe(DENIED)
  })
})

describe('slugify mirrors src/domain/slug.ts', () => {
  it.each([
    'Alex & Sam',
    '  Akshen  and  Anjana  ',
    'Zoë & José',
    'ÅSA + Ñico',
    'Priya_Raj 2027!',
    '--Kim--Lee--',
    '李 & 王',
    '',
    `${'a'.repeat(49)} bcd`,
    'x'.repeat(200),
    'Al',
    'Admin',
    'Shit Happens',
    'Scunthorpe Wedding',
  ])('%j', async (name) => {
    const { data, error } = await admin.rpc('slugify', { p_name: name })
    expect(error).toBeNull()
    expect(data).toBe(slugify(name))
  })
})
