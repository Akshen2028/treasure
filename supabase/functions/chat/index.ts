/**
 * In-app AI chat for planners. Verifies the caller is a planner of the wedding, then streams
 * Claude's answer about the wedding export as newline-delimited JSON (`ChatStreamEvent`).
 * Claude can call two tools, show_chart and propose_edit. Valid calls are forwarded to the
 * browser (which draws the chart or shows an Apply card); invalid ones go back to Claude as
 * errors so it can correct them. Nothing is written here: edits happen in the browser, under
 * the planner's own session and RLS, only after they tap Apply.
 *
 * Each question counts against the wedding's daily limit (`use_ai_question`, service role
 * only) before Claude is called; at the limit the function answers 429.
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`). It never reaches the browser.
 * SUPABASE_SERVICE_ROLE_KEY is provided by Supabase and used only to count questions.
 * Deploy: `supabase functions deploy chat` (JWT is verified here, not by the gateway).
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

import {
  aiLimitMessage,
  CHAT_INSTRUCTIONS,
  CHAT_MODEL,
  type ChatStreamEvent,
  validateChatRequest,
} from '../../../src/domain/chat.ts'
import {
  CHAT_TOOLS,
  parseChartSpec,
  parseEditProposal,
  PROPOSE_EDIT,
  refLookup,
  refsOutline,
  SHOW_CHART,
} from '../../../src/domain/chatTools.ts'

/** Tool round trips per question; a chart and a proposal (plus one retry each) fit easily. */
const MAX_ROUNDS = 5

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

  // Count the question before calling Claude, so cancelling doesn't dodge the limit.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return json(500, 'The assistant isn’t set up yet (missing service key).')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: usage, error: usageError } = await admin
    .rpc('use_ai_question', { p_wedding_id: request.value.weddingId })
    .single<{ allowed: boolean; used: number; daily_limit: number }>()
  if (usageError || !usage) {
    console.error('use_ai_question failed', usageError)
    return json(500, 'Couldn’t check today’s question limit. Try again.')
  }
  if (!usage.allowed) return json(429, aiLimitMessage(usage.daily_limit))

  const { value } = request
  const refs = refLookup(value.refs)
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: CHAT_INSTRUCTIONS },
    // The export is the large, stable part of every turn in a chat; cache it.
    {
      type: 'text',
      text: `<wedding_export>\n${value.exportText}\n</wedding_export>\n\n<references>\n${refsOutline(value.refs, value.today)}\n</references>`,
      cache_control: { type: 'ephemeral' },
    },
  ]
  const messages: Anthropic.MessageParam[] = [...value.messages]
  /** Per tool: whether a call got through, and the last rejection. Never fail silently. */
  const shown = new Set<string>()
  const rejected = new Map<string, string>()

  /** Validates one tool call, forwards it to the browser, and returns what Claude is told. */
  function runTool(
    block: Anthropic.ToolUseBlock,
    send: (event: ChatStreamEvent) => void,
  ): Anthropic.ToolResultBlockParam {
    const result = (content: string, isError = false): Anthropic.ToolResultBlockParam => ({
      type: 'tool_result',
      tool_use_id: block.id,
      content,
      ...(isError && { is_error: true }),
    })
    const reject = (error: string) => {
      console.warn(`${block.name} rejected: ${error}`)
      rejected.set(block.name, error)
      return result(error, true)
    }
    if (block.name === SHOW_CHART) {
      const chart = parseChartSpec(block.input, refs)
      if (!chart.ok) return reject(chart.error)
      shown.add(SHOW_CHART)
      send({ type: 'chart', chart: block.input })
      return result('The chart is now shown below your message.')
    }
    if (block.name === PROPOSE_EDIT) {
      const edit = parseEditProposal(block.input, refs)
      if (!edit.ok) return reject(edit.error)
      shown.add(PROPOSE_EDIT)
      send({ type: 'edit', edit: block.input })
      return result(
        'The proposal is shown to the planner with Apply and Dismiss buttons. Nothing has ' +
          'changed yet; tell them briefly what it does and that they can review and apply it.',
      )
    }
    return result(`Unknown tool ${block.name}.`, true)
  }

  let current: ReturnType<typeof anthropic.messages.stream> | null = null
  /** Whether any of the answer's text has been sent yet, across tool rounds. */
  let wroteText = false
  let cancelled = false
  const encoder = new TextEncoder()
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        for (let round = 0; ; round++) {
          const stream = anthropic.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 16_000,
            // Chat over one document: low effort keeps answers quick and cheap.
            output_config: { effort: 'low' },
            system,
            tools: CHAT_TOOLS,
            // Last round: answer in words only, so the loop always ends.
            tool_choice: round < MAX_ROUNDS ? { type: 'auto' } : { type: 'none' },
            messages,
          })
          current = stream
          let wroteThisRound = false
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              // Text after a chart or proposal starts a new paragraph, if there was text before.
              if (!wroteThisRound && wroteText) send({ type: 'text', text: '\n\n' })
              wroteThisRound = wroteText = true
              send({ type: 'text', text: event.delta.text })
            }
          }
          const final = await stream.finalMessage()
          if (final.stop_reason === 'refusal') {
            send({ type: 'error', message: 'The assistant couldn’t answer that. Try rephrasing.' })
            return
          }
          if (final.stop_reason !== 'tool_use') break
          const calls = final.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
          )
          // The full content (thinking blocks included) goes back with every tool result.
          messages.push({ role: 'assistant', content: final.content })
          messages.push({ role: 'user', content: calls.map((call) => runTool(call, send)) })
        }
        // A proposal (or chart) that never passed the checks: say so, rather than leave an
        // answer that may describe a card the planner can't see.
        const failed =
          rejected.has(PROPOSE_EDIT) && !shown.has(PROPOSE_EDIT)
            ? PROPOSE_EDIT
            : rejected.has(SHOW_CHART) && !shown.has(SHOW_CHART)
              ? SHOW_CHART
              : null
        if (failed) {
          const what = failed === PROPOSE_EDIT ? 'propose that change' : 'draw that chart'
          send({
            type: 'error',
            message: `The assistant couldn’t ${what} (${rejected.get(failed)}). Nothing was changed. Try rephrasing.`,
          })
        } else {
          send({ type: 'done' })
        }
      } catch (error) {
        if (!cancelled) {
          console.error('chat stream failed', error)
          send({ type: 'error', message: describeError(error) })
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      // The planner closed the chat or pressed Stop: stop paying for tokens.
      cancelled = true
      current?.abort()
    },
  })

  return new Response(body$, {
    headers: { ...CORS, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
  })
})
