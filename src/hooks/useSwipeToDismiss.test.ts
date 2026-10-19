import { describe, expect, it } from 'vitest'

import { shouldDismiss } from './useSwipeToDismiss'

describe('shouldDismiss', () => {
  it('closes after dragging well down the sheet', () => {
    expect(shouldDismiss(200, 0.1, 500)).toBe(true)
    expect(shouldDismiss(100, 0.1, 300)).toBe(true)
  })

  it('closes on a quick downward flick', () => {
    expect(shouldDismiss(40, 0.8, 600)).toBe(true)
  })

  it('snaps back after a short, slow drag or a tiny twitch', () => {
    expect(shouldDismiss(80, 0.2, 600)).toBe(false)
    expect(shouldDismiss(10, 2, 600)).toBe(false)
  })
})
