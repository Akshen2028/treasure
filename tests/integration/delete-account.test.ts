/**
 * The `delete-account` Edge Function: refuses anyone without a session or the right
 * confirmation, and for a planner removes the wedding's rows, its photos and the account,
 * leaving every other wedding alone.
 *
 * Sign-ins are rate-limited per IP (Supabase Auth, about 30 per 5 minutes across the whole
 * suite), so this file signs in only twice and doesn't use the shared fixture: one throwaway
 * planner (refused first, then deleted) and one account without a wedding.
 * Requires the function to be deployed (`supabase functions deploy delete-account`).
 */
import { randomBytes, randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminClient, type Client, signedInClient } from './support/clients'
import { TEST_EMAIL_DOMAIN, TEST_SLUG_PREFIX, testEnv } from './support/env'
import { MEDIA_BUCKET } from './support/fixture'

const admin = adminClient()
const runId = randomUUID().slice(0, 8)
const created = { weddings: [] as string[], users: [] as string[] }

let doomed: { userId: string; client: Client; weddingId: string; slug: string }
let bystander: { weddingId: string; slug: string }

async function callDelete(client: Client | null, body: unknown) {
  const { url, publishableKey } = testEnv()
  const token = client && (await client.auth.getSession()).data.session?.access_token
  return fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** A signed-in account, tagged so the global sweep removes it if a run crashes. */
async function throwawayAccount(role: string) {
  const email = `${role}-${runId}${TEST_EMAIL_DOMAIN}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Could not create ${role}: ${error?.message}`)
  created.users.push(data.user.id)
  return { userId: data.user.id, client: await signedInClient(email) }
}

/** A wedding with an event and a stored photo; its slug is tagged for the global sweep. */
async function throwawayWedding(label: string) {
  const slug = `${TEST_SLUG_PREFIX}${runId}-${label}`
  const { data: wedding, error } = await admin
    .from('weddings')
    .insert({ slug, name: `Delete Test ${label}` })
    .select('id')
    .single()
  if (error) throw new Error(`Could not create wedding: ${error.message}`)
  created.weddings.push(wedding.id)
  await admin.from('events').insert({ wedding_id: wedding.id, name: `${label} Reception` })
  const upload = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(
      `${wedding.id}/events/${randomUUID()}/${randomUUID()}.webp`,
      new Blob(['x'], { type: 'image/webp' }),
    )
  if (upload.error) throw new Error(`Could not upload photo: ${upload.error.message}`)
  return { weddingId: wedding.id, slug }
}

async function mediaCount(weddingId: string) {
  const { data } = await admin.storage.from(MEDIA_BUCKET).list(`${weddingId}/events`)
  return (data ?? []).length
}

async function userExists(userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId)
  return Boolean(data.user)
}

async function weddingExists(weddingId: string) {
  const { data } = await admin.from('weddings').select('id').eq('id', weddingId)
  return (data ?? []).length === 1
}

beforeAll(async () => {
  const [account, wedding, other] = await Promise.all([
    throwawayAccount('deleter'),
    throwawayWedding('doomed'),
    throwawayWedding('bystander'),
  ])
  await admin.from('planners').insert({ user_id: account.userId, wedding_id: wedding.weddingId })
  doomed = { ...account, ...wedding }
  bystander = other
})

afterAll(async () => {
  // Normally already gone; this covers a failed run (the global sweep is the backstop).
  for (const id of created.weddings) {
    const { data } = await admin.storage.from(MEDIA_BUCKET).list(`${id}/events`)
    for (const folder of data ?? []) {
      const { data: files } = await admin.storage
        .from(MEDIA_BUCKET)
        .list(`${id}/events/${folder.name}`)
      const paths = (files ?? []).map((f) => `${id}/events/${folder.name}/${f.name}`)
      if (paths.length) await admin.storage.from(MEDIA_BUCKET).remove(paths)
    }
    await admin.from('weddings').delete().eq('id', id)
  }
  await Promise.all(created.users.map((id) => admin.auth.admin.deleteUser(id)))
})

describe('delete-account refuses', () => {
  it('a request with no session', async () => {
    expect((await callDelete(null, { slug: doomed.slug })).status).toBe(401)
  })

  it('a forged token', async () => {
    const { url, publishableKey } = testEnv()
    const response = await fetch(`${url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: 'Bearer not-a-real-token' },
      body: JSON.stringify({ slug: doomed.slug }),
    })
    expect(response.status).toBe(401)
  })

  it('a planner who confirms with a malformed address', async () => {
    expect((await callDelete(doomed.client, { slug: 'Not an address!' })).status).toBe(400)
    expect(await weddingExists(doomed.weddingId)).toBe(true)
    expect(await userExists(doomed.userId)).toBe(true)
  })

  it('a planner who confirms with another wedding’s address', async () => {
    expect((await callDelete(doomed.client, { slug: bystander.slug })).status).toBe(409)
    expect(await weddingExists(doomed.weddingId)).toBe(true)
    expect(await weddingExists(bystander.weddingId)).toBe(true)
    expect(await userExists(doomed.userId)).toBe(true)
  })
})

describe('delete-account deletes', () => {
  it('the wedding, its rows and photos, and the account; nothing else', async () => {
    expect(await mediaCount(doomed.weddingId)).toBe(1)

    expect((await callDelete(doomed.client, { slug: doomed.slug })).status).toBe(200)

    expect(await weddingExists(doomed.weddingId)).toBe(false)
    const { data: events } = await admin
      .from('events')
      .select('id')
      .eq('wedding_id', doomed.weddingId)
    expect(events).toEqual([])
    expect(await mediaCount(doomed.weddingId)).toBe(0)
    expect(await userExists(doomed.userId)).toBe(false)

    // The deleted account's session no longer works anywhere.
    const { data: refreshed } = await doomed.client.auth.refreshSession()
    expect(refreshed.session).toBeNull()

    expect(await weddingExists(bystander.weddingId)).toBe(true)
    expect(await mediaCount(bystander.weddingId)).toBe(1)
  })

  it('an account with no wedding', async () => {
    const lonely = await throwawayAccount('lonely')
    expect((await callDelete(lonely.client, { slug: null })).status).toBe(200)
    expect(await userExists(lonely.userId)).toBe(false)
    expect(await weddingExists(bystander.weddingId)).toBe(true)
  })
})
