import { describe, expect, it } from 'vitest'

import { paths } from './paths'

describe('paths', () => {
  it('builds nested detail URLs down to payments', () => {
    expect(paths.event('e1')).toBe('/events/e1')
    expect(paths.category('e1', 'c1')).toBe('/events/e1/categories/c1')
    expect(paths.activity('e1', 'c1', 'a1')).toBe('/events/e1/categories/c1/activities/a1')
    expect(paths.payments('e1', 'c1', 'a1')).toBe('/events/e1/categories/c1/activities/a1/payments')
  })
})
