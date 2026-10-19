import { type ChatRequest, parseStreamChunk } from '@/domain/chat'
import {
  type ChartSpec,
  type EditProposal,
  parseChartSpec,
  parseEditProposal,
  refLookup,
} from '@/domain/chatTools'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export class ChatError extends Error {}

type StreamHandlers = {
  signal: AbortSignal
  onText: (text: string) => void
  onChart: (chart: ChartSpec) => void
  onEdit: (edit: EditProposal) => void
}

/**
 * Sends the conversation to the `chat` Edge Function and calls the handlers with each piece
 * of the answer as it streams in: text, charts and proposed edits. Resolves when the answer
 * is complete; rejects with a ChatError carrying a message fit for the planner.
 */
export async function streamChat(
  request: ChatRequest,
  { signal, onText, onChart, onEdit }: StreamHandlers,
) {
  // The function has checked tool calls already; the browser parses the same raw input.
  const refs = refLookup(request.refs)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ChatError('Sign in as a planner to use the assistant.')

  const response = await fetch(`${env.supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      apikey: env.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ChatError(body?.error ?? 'The assistant isn’t reachable right now. Try again.')
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const { events, rest } = parseStreamChunk(buffer + value)
    buffer = rest
    for (const event of events) {
      if (event.type === 'text') onText(event.text)
      else if (event.type === 'chart') {
        const chart = parseChartSpec(event.chart, refs)
        if (!chart.ok) throw new ChatError(`The chart couldn’t be shown (${chart.error}).`)
        onChart(chart.value)
      } else if (event.type === 'edit') {
        const edit = parseEditProposal(event.edit, refs)
        if (!edit.ok) {
          throw new ChatError(
            `The proposed change couldn’t be shown (${edit.error}). Nothing was changed.`,
          )
        }
        onEdit(edit.value)
      } else if (event.type === 'error') throw new ChatError(event.message)
      else if (event.type === 'done') return
    }
  }
  // The connection closed without a "done" event (e.g. the function timed out).
  throw new ChatError('The answer was cut off. Try again.')
}
