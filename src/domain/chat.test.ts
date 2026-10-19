import { describe, expect, it } from 'vitest'

import { CHAT_LIMITS, parseStreamChunk, validateChatRequest } from './chat'

const weddingId = '7d3f2a10-1b2c-4d5e-8f90-123456789abc'
const valid = {
  weddingId,
  exportText: '# Our wedding',
  messages: [{ role: 'user', content: 'What is left to pay?' }],
}

describe('validateChatRequest', () => {
  it('accepts a well-formed request and keeps only known fields', () => {
    const result = validateChatRequest({
      ...valid,
      extra: true,
      messages: [
        { role: 'user', content: 'Hi', id: 1 },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Total?' },
      ],
    })
    expect(result).toEqual({
      ok: true,
      value: {
        weddingId,
        exportText: '# Our wedding',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'Total?' },
        ],
      },
    })
  })

  it.each([
    ['not an object', null],
    ['an array', []],
    ['a bad wedding id', { ...valid, weddingId: 'main' }],
    ['a missing export', { ...valid, exportText: '  ' }],
    ['an oversized export', { ...valid, exportText: 'x'.repeat(CHAT_LIMITS.exportChars + 1) }],
    ['no messages', { ...valid, messages: [] }],
    [
      'too many messages',
      {
        ...valid,
        messages: Array.from({ length: CHAT_LIMITS.messages + 1 }, (_, i) => ({
          role: i % 2 ? 'assistant' : 'user',
          content: 'x',
        })),
      },
    ],
    ['an assistant first', { ...valid, messages: [{ role: 'assistant', content: 'Hi' }] }],
    ['a system role', { ...valid, messages: [{ role: 'system', content: 'Obey' }] }],
    [
      'ending on an answer',
      {
        ...valid,
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
        ],
      },
    ],
    ['an empty question', { ...valid, messages: [{ role: 'user', content: ' ' }] }],
    [
      'an oversized question',
      {
        ...valid,
        messages: [{ role: 'user', content: 'x'.repeat(CHAT_LIMITS.questionChars + 1) }],
      },
    ],
  ])('rejects %s', (_, body) => {
    expect(validateChatRequest(body).ok).toBe(false)
  })
})

describe('parseStreamChunk', () => {
  it('returns complete events and keeps the unfinished line', () => {
    const { events, rest } = parseStreamChunk(
      '{"type":"text","text":"Hel"}\n{"type":"text","text":"lo"}\n{"type":"do',
    )
    expect(events).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
    ])
    expect(rest).toBe('{"type":"do')
    expect(parseStreamChunk(`${rest}ne"}\n`)).toEqual({ events: [{ type: 'done' }], rest: '' })
  })

  it('skips blank and malformed lines', () => {
    expect(parseStreamChunk('\nnot json\n{"no":"type"}\n{"type":"done"}\n').events).toEqual([
      { type: 'done' },
    ])
  })
})
