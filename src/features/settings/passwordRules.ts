/** The planner password rules; the setup script and Supabase Auth enforce the same minimum. */
export const MIN_PASSWORD_LENGTH = 12

export type PasswordErrors = { current?: string; next?: string; confirm?: string }

export function validatePasswordChange(
  current: string,
  next: string,
  confirm: string,
): PasswordErrors {
  const errors: PasswordErrors = {}
  if (!current) errors.current = 'Enter your current password.'
  if (next.length < MIN_PASSWORD_LENGTH) {
    errors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase works well.`
  } else if (next === current) {
    errors.next = 'Choose a password different from the current one.'
  }
  if (!errors.next && confirm !== next) errors.confirm = 'The passwords don’t match.'
  return errors
}
