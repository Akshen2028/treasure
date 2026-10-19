/**
 * In-app AI chat for planners. Verifies the caller is a planner of the wedding, then streams
 * Claude's answer about the wedding export as newline-delimited JSON (`ChatStreamEvent`).
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`). It never reaches the browser.
 * Deploy: `supabase functions deploy chat` (JWT is verified here, not by the gateway).
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

import {
  CHAT_INSTRUCTIONS,
  CHAT_MODEL,
  type ChatStreamEvent,
  validateChatRequest,
} from '../../../src/domain/chat.ts'

// Auth is a bearer token, not a cookie, so any origin may call; RLS decides what it may do.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** A friendly message for the planner; details go to the function logs only. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return 'The assistant is busy. Try again shortly.'
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return 'The assistant isn’t set up correctly (API key).'
  }
  if (error instanceof Anthropic.APIError && error.status === 400) {
    return 'The assistant couldn’t take this request. Check the API account has credit.'
  }
  return 'Something went wrong. Try again.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, 'Use POST.')

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const apiKey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!token || !apiKey) return json(401, 'Sign in as a planner to use the assistant.')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await supabase.auth.getUser(token)
  if (!auth.user) return json(401, 'Sign in as a planner to use the assistant.')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, 'Expected a JSON body.')
  }
  const request = validateChatRequest(body)
  if (!request.ok) return json(400, request.error)

  const { data: isPlanner, error: plannerError } = await supabase.rpc('is_planner', {
    target_wedding_id: request.value.weddingId,
  })
  if (plannerError) {
    console.error('is_planner failed', plannerError)
    return json(500, 'Couldn’t check your access. Try again.')
  }
  if (isPlanner !== true) return json(403, 'Only planners of this wedding can use the assistant.')

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) return json(500, 'The assistant isn’t set up yet (missing API key).')
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const stream = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 16_000,
    // Chat over one document: low effort keeps answers quick and cheap.
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: CHAT_INSTRUCTIONS },
      // The export is the large, stable part of every turn in a chat; cache it.
      {
        type: 'text',
        text: `<wedding_export>\n${request.value.exportText}\n</wedding_export>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: request.value.messages,
  })

  const encoder = new TextEncoder()
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text })
          }
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') {
          send({ type: 'error', message: 'The assistant couldn’t answer that. Try rephrasing.' })
        } else {
          send({ type: 'done' })
        }
      } catch (error) {
        if (!stream.aborted) {
          console.error('chat stream failed', error)
          send({ type: 'error', message: describeError(error) })
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      // The planner closed the chat or pressed Stop: stop paying for tokens.
      stream.abort()
    },
  })

  return new Response(body$, {
    headers: { ...CORS, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
  })
})
