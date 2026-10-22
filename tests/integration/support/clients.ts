import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

import { testEnv } from './env'

export type Client = SupabaseClient<Database>

/**
 * The same client without table typing, for tests that loop over table names as strings.
 * Runtime behaviour is identical; only compile-time checks are relaxed.
 */
export const untyped = (client: Client) => client as unknown as SupabaseClient

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const

/** Privileged client (secret key). Bypasses row-level security: setup and cleanup only. */
export function adminClient(): Client {
  const { url, secretKey } = testEnv()
  return createClient<Database>(url, secretKey, noSession)
}

/** Client using the public key with no session, exactly like a guest in the browser. */
export function guestClient(): Client {
  const { url, publishableKey } = testEnv()
  return createClient<Database>(url, publishableKey, noSession)
}

/**
 * Client using the public key, signed in with an email code like the app's email sign-in.
 * The code comes from the admin API instead of an inbox, which also skips the bot check
 * (Supabase requires one when asking for a code or signing in with a password).
 */
export async function signedInClient(email: string): Promise<Client> {
  const { data, error: linkError } = await adminClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError) throw new Error(`No sign-in code for ${email}: ${linkError.message}`)
  const client = guestClient()
  const { error } = await client.auth.verifyOtp({
    email,
    token: data.properties.email_otp,
    type: 'email',
  })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}
