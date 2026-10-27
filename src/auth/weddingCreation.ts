/** Why `create_my_wedding()` did not create a wedding. */
export type CreateWeddingFailure =
  | { reason: 'already-planning' }
  | { reason: 'signed-out' }
  | { reason: 'network' }
  | { reason: 'unknown'; detail: string }

/** The parts of a PostgREST error this app relies on. */
type PostgrestErrorLike = { code?: string; message?: string }

/** Classifies an error from `create_my_wedding()` (codes from its migration). */
export function classifyCreateWeddingError(error: PostgrestErrorLike): CreateWeddingFailure {
  const { code = '', message = '' } = error
  // 23505 is also used when no free address is left; only this message means "one per account".
  if (code === '23505' && /already have a wedding/i.test(message)) {
    return { reason: 'already-planning' }
  }
  if (code === '42501' || code === 'PGRST301' || /JWT/i.test(message)) {
    return { reason: 'signed-out' }
  }
  if (!code && /fetch|network/i.test(message)) return { reason: 'network' }
  return { reason: 'unknown', detail: message || 'Unknown error' }
}

/** Friendly message for the create screen. */
export function createWeddingFailureMessage(failure: CreateWeddingFailure): string {
  switch (failure.reason) {
    case 'already-planning':
      return 'This account already has a wedding.'
    case 'signed-out':
      return 'Your sign-in has expired. Please sign in again.'
    case 'network':
      return 'Couldn’t reach the server. Check your connection and try again.'
    case 'unknown':
      return 'Something went wrong while creating your wedding. Please try again.'
  }
}
