import { describe, expect, it } from 'vitest'

import { classifyOAuthError, parseOAuthCallback, stripOAuthParams } from './oauthCallback'

const BASE = 'https://www.mywedonomics.com'

describe('parseOAuthCallback', () => {
  it('reads an authorization code from the query string', () => {
    expect(parseOAuthCallback(`${BASE}/settings?code=abc123`)).toEqual({
      kind: 'code',
      code: 'abc123',
    })
  })

  it('reads an error from the query string', () => {
    expect(
      parseOAuthCallback(
        `${BASE}/?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed`,
      ),
    ).toEqual({
      kind: 'error',
      error: 'access_denied',
      errorCode: 'signup_disabled',
      description: 'Signups not allowed',
    })
  })

  it('reads an error from the hash', () => {
    expect(parseOAuthCallback(`${BASE}/#error=server_error&error_description=Oops`)).toEqual({
      kind: 'error',
      error: 'server_error',
      errorCode: undefined,
      description: 'Oops',
    })
  })

  it('prefers the error when both are present', () => {
    expect(parseOAuthCallback(`${BASE}/?code=abc&error=access_denied`)?.kind).toBe('error')
  })

  it('returns null for an ordinary URL', () => {
    expect(parseOAuthCallback(`${BASE}/home`)).toBeNull()
    expect(parseOAuthCallback(`${BASE}/search?q=venue#top`)).toBeNull()
  })
})

describe('stripOAuthParams', () => {
  it('removes the callback parameters and keeps the rest', () => {
    expect(stripOAuthParams(`${BASE}/settings?code=abc&q=venue`)).toBe(`${BASE}/settings?q=venue`)
    expect(stripOAuthParams(`${BASE}/?error=access_denied&error_code=signup_disabled`)).toBe(
      `${BASE}/`,
    )
  })

  it('clears a hash that carries callback parameters only', () => {
    expect(stripOAuthParams(`${BASE}/#error=server_error`)).toBe(`${BASE}/`)
    expect(stripOAuthParams(`${BASE}/home#top`)).toBe(`${BASE}/home#top`)
  })
})

describe('classifyOAuthError', () => {
  it('treats disabled sign-ups as an account without planner access', () => {
    expect(
      classifyOAuthError({ kind: 'error', error: 'access_denied', errorCode: 'signup_disabled' }),
    ).toEqual({ reason: 'not-planner' })
  })

  it('stays quiet when the user cancels on Google', () => {
    expect(classifyOAuthError({ kind: 'error', error: 'access_denied' })).toBeNull()
  })

  it('recognises rate limiting', () => {
    expect(
      classifyOAuthError({
        kind: 'error',
        error: 'access_denied',
        errorCode: 'over_request_rate_limit',
      }),
    ).toEqual({ reason: 'rate-limited' })
  })

  it('falls back to unknown with the description', () => {
    expect(
      classifyOAuthError({ kind: 'error', error: 'server_error', description: 'Boom' }),
    ).toEqual({ reason: 'unknown', detail: 'Boom' })
  })
})
