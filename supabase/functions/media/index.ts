/**
 * Signed photo URLs for guests. Photos live in a private bucket, so a guest's browser can't
 * read them directly. This function runs the same check as the guest view (the wedding is
 * public, or the share key matches), then signs exactly the photos that view shows: event
 * covers and the photos of active activities. Soft-deleted photos are never signed.
 *
 * Request: POST { slug, shareKey } → { urls: { [path]: signedUrl } }. 404 when the wedding
 * doesn't exist or may not be viewed (the two are indistinguishable on purpose).
 *
 * Planners don't use this: storage policies let them sign their own wedding's photos.
 * Uses the service role (provided to Edge Functions by Supabase; never sent to browsers).
 * Deploy: `supabase functions deploy media` (no session needed, so the gateway JWT check is off).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const BUCKET = 'wedding-media'
const SIGNED_URL_SECONDS = 3600

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

type GuestView = {
  events: Array<{ cover_image_path: string | null }>
  activity_images: Array<{ storage_path: string; thumbnail_path: string | null }>
}

function parseRequest(body: unknown): { slug: string; shareKey: string | null } | null {
  if (typeof body !== 'object' || body === null) return null
  const { slug, shareKey } = body as Record<string, unknown>
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null
  if (shareKey === undefined || shareKey === null) return { slug, shareKey: null }
  if (typeof shareKey !== 'string' || !/^[0-9a-f]{32}$/.test(shareKey)) return null
  return { slug, shareKey }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Expected a JSON body.' })
  }
  const request = parseRequest(body)
  if (!request) return json(400, { error: 'Expected a wedding slug and optional share key.' })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return json(500, { error: 'Photos aren’t set up correctly.' })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // The service role has no user, so guest_view applies the guest rule only.
  const { data, error } = await admin.rpc('guest_view', {
    p_slug: request.slug,
    p_share_key: request.shareKey,
  })
  if (error) {
    console.error('guest_view failed', error)
    return json(500, { error: 'Couldn’t load photos. Try again.' })
  }
  if (data === null) return json(404, { error: 'Wedding not found.' })

  const view = data as GuestView
  const paths = [
    ...view.events.flatMap((e) => (e.cover_image_path ? [e.cover_image_path] : [])),
    ...view.activity_images.flatMap((i) =>
      i.thumbnail_path ? [i.storage_path, i.thumbnail_path] : [i.storage_path],
    ),
  ]
  if (paths.length === 0) return json(200, { urls: {} })

  const signed = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (signed.error) {
    console.error('createSignedUrls failed', signed.error)
    return json(500, { error: 'Couldn’t load photos. Try again.' })
  }
  const urls = Object.fromEntries(
    signed.data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  )
  return json(200, { urls })
})
