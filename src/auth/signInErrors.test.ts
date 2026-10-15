import { describe, expect, it } from 'vitest'

import { classifySignInError, signInFailureMessage } from './signInErrors'

describe('classifySignInError', () => {
  it('treats invalid credentials as a wrong password', () => {
    expect(classifySignInError({ status: 400, code: 'invalid_credentials' })).toEqual({
      reason: 'wrong-password',
    })
  })

  it('recognises server-side rate limiting', () => {
    expect(classifySignInError({ status: 429 })).toEqual({ reason: 'rate-limited' })
    expect(classifySignInError({ status: 400, code: 'over_request_rate_limit' })).toEqual({
      reason: 'rate-limited',
    })
  })

  it('recognises network failures', () => {
    expect(classifySignInError({ name: 'AuthRetryableFetchError', status: 0 })).toEqual({
      reason: 'network',
    })
  })

  it('falls back to unknown for anything else', () => {
    expect(classifySignInError({ status: 500, message: 'boom' })).toEqual({
      reason: 'unknown',
      detail: 'boom',
    })
  })
})

describe('signInFailureMessage', () => {
  it('formats throttle waits in seconds and minutes', () => {
    expect(signInFailureMessage({ reason: 'throttled', retryInMs: 4_200 })).toContain('5 seconds')
    expect(signInFailureMessage({ reason: 'throttled', retryInMs: 1_000 })).toContain('1 second ')
    expect(signInFailureMessage({ reason: 'throttled', retryInMs: 90_000 })).toContain('2 minutes')
  })

  it('never says whether an account exists', () => {
    const message = signInFailureMessage({ reason: 'wrong-password' })
    expect(message.toLowerCase()).not.toMatch(/account|email|user/)
  })
})
