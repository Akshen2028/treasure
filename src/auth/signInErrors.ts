/** Why a planner sign-in attempt did not succeed. */
export type SignInFailure =
  | { reason: 'wrong-password' }
  | { reason: 'throttled'; retryInMs: number }
  | { reason: 'rate-limited' }
  | { reason: 'not-planner' }
  | { reason: 'not-configured' }
  | { reason: 'network' }
  | { reason: 'unknown'; detail: string }

/** The parts of a Supabase AuthError this app relies on. */
type AuthErrorLike = { status?: number; code?: string; name?: string; message?: string }

/** Classifies a Supabase sign-in error. Never reveals whether the account exists. */
export function classifySignInError(error: AuthErrorLike): SignInFailure {
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return { reason: 'rate-limited' }
  }
  if (error.code === 'invalid_credentials' || error.status === 400) {
    return { reason: 'wrong-password' }
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    error.status === undefined
  ) {
    return { reason: 'network' }
  }
  return { reason: 'unknown', detail: error.message ?? 'Unknown error' }
}

function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

/** Friendly message for the sign-in form. */
export function signInFailureMessage(failure: SignInFailure): string {
  switch (failure.reason) {
    case 'wrong-password':
      return 'That password isn’t right. Please try again.'
    case 'throttled':
      return `Too many attempts. Please wait ${formatWait(failure.retryInMs)} and try again.`
    case 'rate-limited':
      return 'Too many sign-in attempts from this network. Please wait a few minutes.'
    case 'not-planner':
      return 'This account doesn’t have planner access to this wedding.'
    case 'not-configured':
      return 'Planner sign-in isn’t set up yet. Add VITE_PLANNER_EMAIL to .env.local.'
    case 'network':
      return 'Couldn’t reach the server. Check your connection and try again.'
    case 'unknown':
      return 'Something went wrong while signing in. Please try again.'
  }
}
