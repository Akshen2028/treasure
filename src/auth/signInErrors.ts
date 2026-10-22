/** Why a planner sign-in attempt did not succeed. */
export type SignInFailure =
  | { reason: 'wrong-password' }
  | { reason: 'wrong-code' }
  | { reason: 'bot-check' }
  | { reason: 'email-not-sent' }
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
  if (error.code === 'captcha_failed') return { reason: 'bot-check' }
  // Supabase reports a mistyped code and an expired one the same way.
  if (error.code === 'otp_expired') return { reason: 'wrong-code' }
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

/**
 * True when an email code was refused only because no such account exists (sign-ups are off).
 * The form treats this like a sent code, so it can't be used to discover who has an account.
 */
export function isUnknownAccountError(error: AuthErrorLike): boolean {
  return (
    error.code === 'otp_disabled' ||
    error.code === 'signup_disabled' ||
    error.code === 'user_not_found'
  )
}

/**
 * Classifies a failed request for an email code. A server error here means the email couldn't
 * be handed to the mail provider (e.g. SMTP misconfigured or down), not a lost connection.
 */
export function classifyEmailCodeError(error: AuthErrorLike): SignInFailure {
  if (error.status !== undefined && error.status >= 500) return { reason: 'email-not-sent' }
  return classifySignInError(error)
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
    case 'wrong-code':
      return 'That code isn’t right or has expired. Check the latest email, or send a new code.'
    case 'bot-check':
      return 'The security check didn’t go through. Please wait a moment and try again.'
    case 'email-not-sent':
      return 'We couldn’t send the email just now. Please try again in a few minutes.'
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
