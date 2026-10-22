/**
 * Planner sessions: sign-in is by emailed code (Supabase Auth), write access follows the
 * session, and signing out or presenting a bad token removes it.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminClient, guestClient, signedInClient } from './support/clients'
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
  it('grants write access only while signed in, and removes it on sign-out', async () => {
    const client = await signedInClient(f.planner.email)
    expect((await insertEvent(client)).error).toBeNull()

    await client.auth.signOut()
    const afterSignOut = await insertEvent(client)
    expect(afterSignOut.error?.code).toBe('42501')
  })

  it('keeps write access after refreshing the session', async () => {
    const client = await signedInClient(f.planner.email)
    const before = (await client.auth.getSession()).data.session
    const { data, error } = await client.auth.refreshSession()
    expect(error).toBeNull()
    expect(data.session?.access_token).toBeTruthy()
    expect(data.session?.refresh_token).not.toBe(before?.refresh_token)
    expect((await insertEvent(client)).error).toBeNull()
    await client.auth.signOut()
  })

  it('revokes every session when signing out everywhere', async () => {
    const phone = await signedInClient(f.planner.email)
    const laptop = await signedInClient(f.planner.email)
    const laptopRefresh = (await laptop.auth.getSession()).data.session!.refresh_token

    await phone.auth.signOut({ scope: 'global' })

    const { error } = await guestClient().auth.refreshSession({ refresh_token: laptopRefresh })
    expect(error).not.toBeNull()
  })

  it('rejects a forged or tampered access token', async () => {
    const client = await signedInClient(f.planner.email)
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
})

describe('email codes', () => {
  const newCode = async () => {
    const { data, error } = await adminClient().auth.admin.generateLink({
      type: 'magiclink',
      email: f.planner.email,
    })
    if (error) throw error
    return data.properties.email_otp
  }

  it('signs in with an emailed code, which works only once', async () => {
    const code = await newCode()
    const client = guestClient()
    const first = await client.auth.verifyOtp({
      email: f.planner.email,
      token: code,
      type: 'email',
    })
    expect(first.error).toBeNull()
    expect((await insertEvent(client)).error).toBeNull()

    const again = await guestClient().auth.verifyOtp({
      email: f.planner.email,
      token: code,
      type: 'email',
    })
    expect(again.error).not.toBeNull()
    expect(again.data.session).toBeNull()
    await client.auth.signOut()
  })

  it('rejects a wrong code without creating a session', async () => {
    const code = await newCode()
    const wrong = code === '000000' ? '111111' : '000000'
    const { data, error } = await guestClient().auth.verifyOtp({
      email: f.planner.email,
      token: wrong,
      type: 'email',
    })
    expect(error?.code).toBe('otp_expired')
    expect(data.session).toBeNull()
  })
})

describe('bot check', () => {
  it('refuses code requests and password sign-ins without a bot-check token', async () => {
    const code = await guestClient().auth.signInWithOtp({
      email: f.planner.email,
      options: { shouldCreateUser: false },
    })
    expect(code.error?.code).toBe('captcha_failed')

    // The app has no password sign-in, but Supabase still accepts the method for accounts that
    // have a password (the test accounts do), so it must be covered by the check too.
    const password = await guestClient().auth.signInWithPassword({
      email: f.planner.email,
      password: f.planner.password,
    })
    expect(password.error?.code).toBe('captcha_failed')
    expect(password.data.session).toBeNull()
  })
})
