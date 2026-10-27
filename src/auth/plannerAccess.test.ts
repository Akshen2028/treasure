import { describe, expect, it } from 'vitest'

import { showsPlannerControls } from './plannerAccess'

describe('showsPlannerControls', () => {
  it('is true only on the wedding the planner plans', () => {
    expect(showsPlannerControls('main', 'main')).toBe(true)
    expect(showsPlannerControls('main', 'alex-sam')).toBe(false)
  })

  it('is false for guests everywhere', () => {
    expect(showsPlannerControls(null, 'main')).toBe(false)
    expect(showsPlannerControls(null, null)).toBe(false)
  })

  it('outside a wedding, says whether a planner is signed in', () => {
    expect(showsPlannerControls('main', null)).toBe(true)
  })
})
