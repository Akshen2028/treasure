import { describe, expect, it } from 'vitest'

import { deleteAccountFailureMessage, deleteConfirmationMatches } from './accountDeletion'

describe('deleteConfirmationMatches', () => {
  it('accepts the exact web address', () => {
    expect(deleteConfirmationMatches('alex-sam', 'alex-sam')).toBe(true)
  })

  it('forgives case and surrounding spaces', () => {
    expect(deleteConfirmationMatches('  Alex-Sam ', 'alex-sam')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(deleteConfirmationMatches('', 'alex-sam')).toBe(false)
    expect(deleteConfirmationMatches('alex', 'alex-sam')).toBe(false)
    expect(deleteConfirmationMatches('alex sam', 'alex-sam')).toBe(false)
    expect(deleteConfirmationMatches('alex-sam2', 'alex-sam')).toBe(false)
  })
})

describe('deleteAccountFailureMessage', () => {
  it('explains a lost connection', () => {
    expect(deleteAccountFailureMessage(null, null)).toMatch(/couldn’t reach the server/i)
  })

  it('asks to sign in again when the session expired', () => {
    expect(deleteAccountFailureMessage(401, { error: 'Sign in to delete your account.' })).toMatch(
      /sign in again/i,
    )
  })

  it('shows the function’s own message', () => {
    expect(deleteAccountFailureMessage(409, { error: 'The web address doesn’t match.' })).toBe(
      'The web address doesn’t match.',
    )
  })

  it('falls back to a generic message', () => {
    expect(deleteAccountFailureMessage(502, null)).toBe(
      'Couldn’t delete your account. Please try again.',
    )
    expect(deleteAccountFailureMessage(500, { error: 42 })).toBe(
      'Couldn’t delete your account. Please try again.',
    )
  })
})
