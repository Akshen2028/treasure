import { randomBytes, randomUUID } from 'node:crypto'

import { adminClient, type Client, guestClient, signedInClient } from './clients'
import { TEST_EMAIL_DOMAIN, TEST_SLUG_PREFIX } from './env'

export const MEDIA_BUCKET = 'wedding-media'

type TestUser = { id: string; email: string; password: string }

export type Fixture = {
  admin: Client
  /** Wedding the planner can edit. */
  weddingId: string
  weddingSlug: string
  /** Opens `weddingId` (private, like every new wedding) through the guest view. */
  weddingShareKey: string
  /** A second wedding the planner has no rights to. */
  otherWeddingId: string
  /** One event → category → activity → payment chain inside `weddingId`. */
  eventId: string
  eventCategoryId: string
  categoryDefinitionId: string
  activityId: string
  paymentId: string
  /** Same chain inside `otherWeddingId`. */
  otherEventId: string
  otherActivityId: string
  planner: TestUser
  outsider: TestUser
  guest: Client
  plannerClient: Client
  outsiderClient: Client
  cleanup: () => Promise<void>
}

function must<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  what: string,
): NonNullable<R['data']> {
  if (result.error || result.data === null) {
    throw new Error(`Fixture setup failed (${what}): ${result.error?.message ?? 'no data'}`)
  }
  return result.data as NonNullable<R['data']>
}

async function createUser(admin: Client, role: string, runId: string): Promise<TestUser> {
  const email = `${role}-${runId}${TEST_EMAIL_DOMAIN}`
  const password = randomBytes(24).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Could not create ${role} user: ${error?.message}`)
  return { id: data.user.id, email, password }
}

async function createChain(admin: Client, weddingId: string, label: string) {
  const definition = must(
    await admin
      .from('category_definitions')
      .select('id')
      .eq('wedding_id', weddingId)
      .eq('name', 'Decor')
      .single(),
    `${label} definition`,
  )
  const event = must(
    await admin
      .from('events')
      .insert({ wedding_id: weddingId, name: `${label} Reception` })
      .select('id')
      .single(),
    `${label} event`,
  )
  const category = must(
    await admin
      .from('event_categories')
      .insert({
        wedding_id: weddingId,
        event_id: event.id,
        category_definition_id: definition.id,
      })
      .select('id')
      .single(),
    `${label} category`,
  )
  const activity = must(
    await admin
      .from('activities')
      .insert({
        wedding_id: weddingId,
        event_category_id: category.id,
        name: `${label} Florals`,
        budget_cents: 150_000,
      })
      .select('id')
      .single(),
    `${label} activity`,
  )
  const payment = must(
    await admin
      .from('payments')
      .insert({
        wedding_id: weddingId,
        activity_id: activity.id,
        amount_cents: 50_000,
        paid_on: '2026-09-01',
      })
      .select('id')
      .single(),
    `${label} payment`,
  )
  return {
    definitionId: definition.id,
    eventId: event.id,
    categoryId: category.id,
    activityId: activity.id,
    paymentId: payment.id,
  }
}

/** Removes every storage object under a wedding's folder. */
async function removeWeddingMedia(admin: Client, weddingId: string) {
  const paths: string[] = []
  async function walk(prefix: string) {
    const { data } = await admin.storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000 })
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`
      // Folders have no id in storage listings.
      if (entry.id) paths.push(path)
      else await walk(path)
    }
  }
  await walk(weddingId)
  if (paths.length) await admin.storage.from(MEDIA_BUCKET).remove(paths)
}

/**
 * Creates two isolated test weddings and three kinds of user (guest, outsider, planner).
 * Everything created is tagged and removed by `cleanup`, and by the global sweep if a run crashes.
 */
export async function createFixture(): Promise<Fixture> {
  const admin = adminClient()
  const runId = randomUUID().slice(0, 8)
  const insertWedding = async (slug: string, name: string) =>
    must(await admin.from('weddings').insert({ slug, name }).select('id, share_key').single(), name)

  // Independent steps run concurrently: each request has noticeable network latency.
  const [wedding, other, planner, outsider] = await Promise.all([
    insertWedding(`${TEST_SLUG_PREFIX}${runId}`, 'Integration Test Wedding'),
    insertWedding(`${TEST_SLUG_PREFIX}${runId}-other`, 'Other Test Wedding'),
    createUser(admin, 'planner', runId),
    createUser(admin, 'outsider', runId),
  ])

  const [, main, second, plannerClient, outsiderClient] = await Promise.all([
    admin
      .from('planners')
      .insert({ user_id: planner.id, wedding_id: wedding.id })
      .select()
      .single()
      .then((r) => must(r, 'planner membership')),
    createChain(admin, wedding.id, 'Main'),
    createChain(admin, other.id, 'Other'),
    signedInClient(planner.email),
    signedInClient(outsider.email),
  ])

  const fixture: Fixture = {
    admin,
    weddingId: wedding.id,
    weddingSlug: `${TEST_SLUG_PREFIX}${runId}`,
    weddingShareKey: wedding.share_key,
    otherWeddingId: other.id,
    eventId: main.eventId,
    eventCategoryId: main.categoryId,
    categoryDefinitionId: main.definitionId,
    activityId: main.activityId,
    paymentId: main.paymentId,
    otherEventId: second.eventId,
    otherActivityId: second.activityId,
    planner,
    outsider,
    guest: guestClient(),
    plannerClient,
    outsiderClient,
    cleanup: async () => {
      await Promise.all([
        plannerClient.auth.signOut().catch(() => {}),
        outsiderClient.auth.signOut().catch(() => {}),
      ])
      await Promise.all(
        [wedding.id, other.id].map(async (id) => {
          await removeWeddingMedia(admin, id)
          await admin.from('weddings').delete().eq('id', id)
        }),
      )
      await Promise.all([
        admin.auth.admin.deleteUser(planner.id),
        admin.auth.admin.deleteUser(outsider.id),
      ])
    },
  }
  return fixture
}

/** Deletes leftovers from crashed runs: test weddings, their media, and test users. */
export async function sweepTestData() {
  const admin = adminClient()
  const { data: weddings } = await admin
    .from('weddings')
    .select('id')
    .like('slug', `${TEST_SLUG_PREFIX}%`)
  for (const { id } of weddings ?? []) {
    await removeWeddingMedia(admin, id)
    await admin.from('weddings').delete().eq('id', id)
  }

  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const user of data?.users ?? []) {
    if (user.email?.endsWith(TEST_EMAIL_DOMAIN)) await admin.auth.admin.deleteUser(user.id)
  }
}
