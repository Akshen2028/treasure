import type { SignInFailure } from './signInErrors'

/** What Supabase Auth put in the URL when it sent the browser back from Google. */
export type OAuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'error'; error: string; errorCode?: string; description?: string }

const CALLBACK_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state'] as const

/** Reads an OAuth callback from the query string or, for errors, the hash. */
export function parseOAuthCallback(href: string): OAuthCallback | null {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const read = (name: string) => url.searchParams.get(name) ?? hash.get(name) ?? undefined

  const error = read('error')
  const errorCode = read('error_code')
  if (error || errorCode) {
    return {
      kind: 'error',
      error: error ?? errorCode ?? 'unknown',
      errorCode,
      description: read('error_description'),
    }
  }
  const code = url.searchParams.get('code')
  return code ? { kind: 'code', code } : null
}

/** The same URL without the callback parameters, so a reload doesn't replay them. */
export function stripOAuthParams(href: string): string {
  const url = new URL(href)
  for (const name of CALLBACK_PARAMS) url.searchParams.delete(name)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (CALLBACK_PARAMS.some((name) => hash.has(name))) url.hash = ''
  return url.toString()
}

/**
 * Classifies an error returned by the OAuth redirect. Returns null when the user simply
 * cancelled on Google's screen, which needs no message.
 */
export function classifyOAuthError(
  callback: Extract<OAuthCallback, { kind: 'error' }>,
): SignInFailure | null {
  // Public sign-ups are off, so a Google account with no matching user is refused here.
  if (callback.errorCode === 'signup_disabled') return { reason: 'not-planner' }
  if (callback.error === 'access_denied' && !callback.errorCode) return null
  if (callback.errorCode === 'over_request_rate_limit') return { reason: 'rate-limited' }
  return { reason: 'unknown', detail: callback.description ?? callback.error }
}
