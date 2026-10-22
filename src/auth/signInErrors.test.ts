import { describe, expect, it } from 'vitest'

import {
  classifyEmailCodeError,
  classifySignInError,
  isUnknownAccountError,
  signInFailureMessage,
} from './signInErrors'

describe('classifySignInError', () => {
  it('recognises server-side rate limiting', () => {
    expect(classifySignInError({ status: 429 })).toEqual({ reason: 'rate-limited' })
    expect(classifySignInError({ status: 400, code: 'over_request_rate_limit' })).toEqual({
      reason: 'rate-limited',
    })
  })

  it('recognises a failed bot check', () => {
    expect(classifySignInError({ status: 400, code: 'captcha_failed' })).toEqual({
      reason: 'bot-check',
    })
  })

  it('treats a wrong or expired email code as a wrong code', () => {
    expect(classifySignInError({ status: 403, code: 'otp_expired' })).toEqual({
      reason: 'wrong-code',
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

describe('classifyEmailCodeError', () => {
  it('reports server errors as an email that could not be sent', () => {
    expect(
      classifyEmailCodeError({ status: 500, message: 'Error sending magic link email' }),
    ).toEqual({ reason: 'email-not-sent' })
    expect(classifyEmailCodeError({ name: 'AuthRetryableFetchError', status: 504 })).toEqual({
      reason: 'email-not-sent',
    })
  })

  it('otherwise classifies like any sign-in error', () => {
    expect(classifyEmailCodeError({ status: 429, code: 'over_email_send_rate_limit' })).toEqual({
      reason: 'rate-limited',
    })
    expect(classifyEmailCodeError({ name: 'AuthRetryableFetchError', status: 0 })).toEqual({
      reason: 'network',
    })
  })
})

describe('isUnknownAccountError', () => {
  it('recognises refusals that only mean the account does not exist', () => {
    expect(isUnknownAccountError({ status: 422, code: 'otp_disabled' })).toBe(true)
    expect(isUnknownAccountError({ status: 422, code: 'signup_disabled' })).toBe(true)
    expect(isUnknownAccountError({ status: 429, code: 'over_email_send_rate_limit' })).toBe(false)
    expect(isUnknownAccountError({ status: 400, code: 'captcha_failed' })).toBe(false)
  })
})

describe('signInFailureMessage', () => {
  it('never says whether an account exists', () => {
    const message = signInFailureMessage({ reason: 'wrong-code' })
    expect(message.toLowerCase()).not.toMatch(/account|user/)
  })
})
