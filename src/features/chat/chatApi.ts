import { type ChatRequest, parseStreamChunk } from '@/domain/chat'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export class ChatError extends Error {}

/**
 * Sends the conversation to the `chat` Edge Function and calls `onText` with each piece of
 * the answer as it streams in. Resolves when the answer is complete; rejects with a
 * ChatError carrying a message fit for the planner.
 */
export async function streamChat(
  request: ChatRequest,
  { signal, onText }: { signal: AbortSignal; onText: (text: string) => void },
) {
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
      else if (event.type === 'error') throw new ChatError(event.message)
      else if (event.type === 'done') return
    }
  }
  // The connection closed without a "done" event (e.g. the function timed out).
  throw new ChatError('The answer was cut off. Try again.')
}
