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

/** Client using the public key, signed in with a password like the planner login. */
export async function signedInClient(email: string, password: string): Promise<Client> {
  const client = guestClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}
