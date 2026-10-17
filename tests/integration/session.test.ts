/**
 * Planner sessions: passwords are checked by Supabase Auth, write access follows the session,
 * and signing out or presenting a bad token removes it.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { guestClient, signedInClient } from './support/clients'
import { testEnv } from './support/env'
import { createFixture, type Fixture } from './support/fixture'

let f: Fixture

beforeAll(async () => {
  f = await createFixture()
})

afterAll(async () => {
  await f?.cleanup()
})

const insertEvent = (client: Fixture['guest']) =>
  client.from('events').insert({ wedding_id: f.weddingId, name: 'Session check' }).select('id')

describe('planner sessions', () => {
  it('rejects a wrong password without creating a session', async () => {
    const client = guestClient()
    const { data, error } = await client.auth.signInWithPassword({
      email: f.planner.email,
      password: 'definitely-not-the-password',
    })
    expect(error).not.toBeNull()
    expect(data.session).toBeNull()
  })

  it('rejects an unknown account with the same error as a wrong password', async () => {
    const wrongPassword = await guestClient().auth.signInWithPassword({
      email: f.planner.email,
      password: 'definitely-not-the-password',
    })
    const unknownUser = await guestClient().auth.signInWithPassword({
      email: `nobody-${crypto.randomUUID()}@integration.wedonomics.test`,
      password: 'definitely-not-the-password',
    })
    expect(unknownUser.error?.message).toBe(wrongPassword.error?.message)
  })

  it('grants write access only while signed in, and removes it on sign-out', async () => {
    const client = await signedInClient(f.planner.email, f.planner.password)
    expect((await insertEvent(client)).error).toBeNull()

    await client.auth.signOut()
    const afterSignOut = await insertEvent(client)
    expect(afterSignOut.error?.code).toBe('42501')
  })

  it('keeps write access after refreshing the session', async () => {
    const client = await signedInClient(f.planner.email, f.planner.password)
    const before = (await client.auth.getSession()).data.session
    const { data, error } = await client.auth.refreshSession()
    expect(error).toBeNull()
    expect(data.session?.access_token).toBeTruthy()
    expect(data.session?.refresh_token).not.toBe(before?.refresh_token)
    expect((await insertEvent(client)).error).toBeNull()
    await client.auth.signOut()
  })

  it('revokes every session when signing out everywhere', async () => {
    const phone = await signedInClient(f.planner.email, f.planner.password)
    const laptop = await signedInClient(f.planner.email, f.planner.password)
    const laptopRefresh = (await laptop.auth.getSession()).data.session!.refresh_token

    await phone.auth.signOut({ scope: 'global' })

    const { error } = await guestClient().auth.refreshSession({ refresh_token: laptopRefresh })
    expect(error).not.toBeNull()
  })

  it('rejects a forged or tampered access token', async () => {
    const client = await signedInClient(f.planner.email, f.planner.password)
    const token = (await client.auth.getSession()).data.session!.access_token
    const [header, payload] = token.split('.')
    const forged = `${header}.${payload}.invalidsignature`

    const { url, publishableKey } = testEnv()
    const attacker = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${forged}` } },
    })
    const { error } = await insertEvent(attacker)
    expect(error).not.toBeNull()
    await client.auth.signOut()
  })

  it('changes the password: the old one stops working, the new one works, other devices are signed out', async () => {
    const phone = await signedInClient(f.planner.email, f.planner.password)
    const laptop = await signedInClient(f.planner.email, f.planner.password)
    const laptopRefresh = (await laptop.auth.getSession()).data.session!.refresh_token
    const next = `${f.planner.password}-changed`

    // The app re-checks the current password first, which also gives a fresh session.
    expect(
      (
        await phone.auth.signInWithPassword({
          email: f.planner.email,
          password: f.planner.password,
        })
      ).error,
    ).toBeNull()
    expect((await phone.auth.updateUser({ password: next })).error).toBeNull()
    expect((await phone.auth.signOut({ scope: 'others' })).error).toBeNull()

    const old = await guestClient().auth.signInWithPassword({
      email: f.planner.email,
      password: f.planner.password,
    })
    expect(old.error).not.toBeNull()
    const fresh = await guestClient().auth.signInWithPassword({
      email: f.planner.email,
      password: next,
    })
    expect(fresh.error).toBeNull()

    const { error: laptopError } = await guestClient().auth.refreshSession({
      refresh_token: laptopRefresh,
    })
    expect(laptopError).not.toBeNull()
    expect((await insertEvent(phone)).error).toBeNull()

    // Leave the fixture's password as it was for any later test.
    await phone.auth.updateUser({ password: f.planner.password })
    await phone.auth.signOut()
  })
})
