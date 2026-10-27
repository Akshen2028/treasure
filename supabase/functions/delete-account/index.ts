/**
 * Deletes the signed-in account and the wedding it plans, permanently: the wedding's photos,
 * then the wedding row (every event, category, activity, payment, link and photo record goes
 * with it through `on delete cascade`), then the auth user (its planner rows cascade too, and
 * every session ends). Recently Deleted can't bring any of it back.
 *
 * Request: POST { slug } with the planner's session. `slug` is the web address the planner
 * typed to confirm; it must match the wedding the account plans (409 if it changed meanwhile).
 * An account with no wedding (null is fine) only loses the account. → 200 { deleted: true }.
 *
 * Each step can be retried: a run that failed part-way finds less to delete next time.
 * Uses the service role (provided to Edge Functions by Supabase; never sent to browsers).
 * Deploy: `supabase functions deploy delete-account` (the function verifies the session
 * itself, like `chat`, so the gateway JWT check is off).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

const BUCKET = 'wedding-media'
const PAGE = 1000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const fail = (status: number, error: string) => json(status, { error })

function parseRequest(body: unknown): { slug: string | null } | null {
  if (typeof body !== 'object' || body === null) return null
  const { slug } = body as Record<string, unknown>
  if (slug === null) return { slug: null }
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null
  return { slug }
}

/** Every stored file under `{weddingId}/`, walking the folders (listings aren't recursive). */
async function weddingMediaPaths(admin: SupabaseClient, weddingId: string) {
  const paths: string[] = []
  async function walk(prefix: string) {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset })
      if (error) throw error
      for (const entry of data) {
        const path = `${prefix}/${entry.name}`
        // Folders have no id in storage listings.
        if (entry.id) paths.push(path)
        else await walk(path)
      }
      if (data.length < PAGE) return
    }
  }
  await walk(weddingId)
  return paths
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return fail(405, 'Use POST.')

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return fail(500, 'Deleting isn’t set up correctly.')
  if (!token) return fail(401, 'Sign in to delete your account.')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth.user) return fail(401, 'Sign in to delete your account.')
  const userId = auth.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  const request = parseRequest(body)
  if (!request) return fail(400, 'Expected the wedding’s web address to confirm.')

  const { data: planned, error: plannedError } = await admin
    .from('planners')
    .select('wedding_id, weddings (slug)')
    .eq('user_id', userId)
  if (plannedError) {
    console.error('planners lookup failed', plannedError)
    return fail(500, 'Couldn’t delete your account. Try again.')
  }
  // One wedding per account; anything else needs a person to look at it.
  if (planned.length > 1) return fail(409, 'This account plans more than one wedding.')

  const wedding = planned[0]
    ? {
        id: planned[0].wedding_id as string,
        slug: (planned[0].weddings as unknown as { slug: string }).slug,
      }
    : null
  if (wedding && request.slug !== wedding.slug) {
    return fail(409, 'The web address doesn’t match your wedding. Reload and try again.')
  }

  if (wedding) {
    // Photos first: once the row is gone, nothing would point at them.
    try {
      const paths = await weddingMediaPaths(admin, wedding.id)
      for (let i = 0; i < paths.length; i += PAGE) {
        const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + PAGE))
        if (error) throw error
      }
    } catch (error) {
      console.error('removing photos failed', error)
      return fail(500, 'Couldn’t delete your photos. Nothing else was deleted. Try again.')
    }

    const { error } = await admin.from('weddings').delete().eq('id', wedding.id)
    if (error) {
      console.error('deleting the wedding failed', error)
      return fail(500, 'Couldn’t delete your wedding. Try again.')
    }
  }

  const { error: userError } = await admin.auth.admin.deleteUser(userId)
  if (userError) {
    console.error('deleting the user failed', userError)
    return fail(500, 'Your wedding was deleted, but your account wasn’t. Try again.')
  }
  return json(200, { deleted: true })
})
