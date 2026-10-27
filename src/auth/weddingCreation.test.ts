import { describe, expect, it } from 'vitest'

import { classifyCreateWeddingError, createWeddingFailureMessage } from './weddingCreation'

describe('classifyCreateWeddingError', () => {
  it('recognises an account that already plans a wedding', () => {
    expect(
      classifyCreateWeddingError({ code: '23505', message: 'You already have a wedding' }),
    ).toEqual({ reason: 'already-planning' })
  })

  it('treats running out of addresses as an unknown failure, not an existing wedding', () => {
    expect(
      classifyCreateWeddingError({
        code: '23505',
        message: 'Could not find a free address for this wedding',
      }),
    ).toEqual({ reason: 'unknown', detail: 'Could not find a free address for this wedding' })
  })

  it('recognises a missing or expired session', () => {
    expect(
      classifyCreateWeddingError({ code: '42501', message: 'Sign in to create a wedding' }),
    ).toEqual({ reason: 'signed-out' })
    expect(classifyCreateWeddingError({ code: 'PGRST301', message: 'JWT expired' })).toEqual({
      reason: 'signed-out',
    })
  })

  it('recognises a lost connection', () => {
    expect(classifyCreateWeddingError({ code: '', message: 'TypeError: Failed to fetch' })).toEqual(
      { reason: 'network' },
    )
  })

  it('has a message for every failure', () => {
    expect(createWeddingFailureMessage({ reason: 'unknown', detail: 'x' })).toMatch(/try again/)
    expect(createWeddingFailureMessage({ reason: 'signed-out' })).toMatch(/sign in again/)
  })
})
