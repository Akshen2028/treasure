import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '@/domain/chat'

import { ChatError, streamChat } from './chatApi'

vi.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://example.test', supabasePublishableKey: 'key' },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  },
}))

/** Answers the next fetch with these events, as the function streams them. */
function respondWith(events: ChatStreamEvent[]) {
  const body = events.map((e) => `${JSON.stringify(e)}\n`).join('')
  vi.stubGlobal('fetch', async () => new Response(body, { status: 200 }))
}

const request = {
  weddingId: '7d3f2a10-1b2c-4d5e-8f90-123456789abc',
  exportText: '# Wedding',
  messages: [{ role: 'user' as const, content: 'Add a photobooth, $1,000' }],
  refs: [
    { ref: 'E1', kind: 'event' as const, name: 'Mehndi' },
    { ref: 'C1', kind: 'category' as const, name: 'Photographer' },
  ],
  today: '2026-10-19',
}

function handlers() {
  return {
    signal: new AbortController().signal,
    onText: vi.fn(),
    onChart: vi.fn(),
    onEdit: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('streamChat', () => {
  it('parses the proposal as Claude wrote it, keeping the budget', async () => {
    // The function forwards Claude's raw tool input; the browser parses it the same way.
    respondWith([
      { type: 'text', text: 'Proposed.' },
      {
        type: 'edit',
        edit: {
          summary: 'Add a photobooth',
          changes: [
            {
              op: 'create_activity',
              event: 'E1',
              category: 'C1',
              name: 'Photobooth',
              budget: '1000',
            },
          ],
        },
      },
      { type: 'done' },
    ])
    const h = handlers()
    await streamChat(request, h)
    expect(h.onText).toHaveBeenCalledWith('Proposed.')
    expect(h.onEdit).toHaveBeenCalledWith({
      summary: 'Add a photobooth',
      changes: [
        {
          op: 'create_activity',
          as: null,
          category: 'C1',
          name: 'Photobooth',
          budgetCents: 100000,
        },
      ],
    })
  })

  it('reports a proposal or chart it can’t show instead of dropping it', async () => {
    respondWith([
      { type: 'edit', edit: { summary: 'x', changes: [{ op: 'delete', target: 'A9' }] } },
    ])
    await expect(streamChat(request, handlers())).rejects.toThrow(ChatError)
    respondWith([{ type: 'chart', chart: { title: 'x', groupBy: 'nothing' } }])
    await expect(streamChat(request, handlers())).rejects.toThrow(/chart couldn’t be shown/)
  })
})
