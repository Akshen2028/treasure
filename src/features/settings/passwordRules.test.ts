import { describe, expect, it } from 'vitest'

import { validatePasswordChange } from './passwordRules'

describe('validatePasswordChange', () => {
  it('accepts a long, new, confirmed password', () => {
    expect(
      validatePasswordChange('old-password-123', 'marigold mandap 2028', 'marigold mandap 2028'),
    ).toEqual({})
  })

  it('requires the current password', () => {
    expect(
      validatePasswordChange('', 'marigold mandap 2028', 'marigold mandap 2028').current,
    ).toBeDefined()
  })

  it('requires at least 12 characters', () => {
    expect(validatePasswordChange('x', 'short', 'short').next).toMatch(/12 characters/)
  })

  it('rejects reusing the current password', () => {
    expect(
      validatePasswordChange('same-password-123', 'same-password-123', 'same-password-123').next,
    ).toMatch(/different/)
  })

  it('requires the confirmation to match', () => {
    expect(
      validatePasswordChange('x', 'marigold mandap 2028', 'marigold mandap 2029').confirm,
    ).toBeDefined()
  })
})
