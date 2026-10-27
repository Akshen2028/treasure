/**
 * The typed confirmation for "Delete wedding and account": the wedding's web address,
 * forgiving case and surrounding spaces, but nothing else.
 */
export function deleteConfirmationMatches(typed: string, slug: string): boolean {
  return typed.trim().toLowerCase() === slug
}

/** Friendly message for a failed `delete-account` call, given its status and JSON body. */
export function deleteAccountFailureMessage(status: number | null, body: unknown): string {
  if (status === null) return 'Couldn’t reach the server. Check your connection and try again.'
  if (status === 401) return 'Your sign-in has expired. Please sign in again.'
  const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null
  if (typeof error === 'string' && error) return error
  return 'Couldn’t delete your account. Please try again.'
}
