import { describe, expect, it } from 'vitest'

import { sortEvents } from './ordering'
import { SnapshotBuilder } from './testing/factories'

describe('sortEvents', () => {
  it('orders by date, undated last, then sort order and creation time', () => {
    const events = new SnapshotBuilder()
      .event('undated', 0, { eventDate: null })
      .event('reception', 0, { eventDate: '2028-07-02' })
      .event('mehndi', 0, { eventDate: '2028-06-29' })
      .event('ceremony-b', 0, { eventDate: '2028-07-01', sortOrder: 2 })
      .event('ceremony-a', 0, { eventDate: '2028-07-01', sortOrder: 1 })
      .build().events

    expect(sortEvents(events).map((e) => e.id)).toEqual([
      'mehndi',
      'ceremony-a',
      'ceremony-b',
      'reception',
      'undated',
    ])
  })

  it('does not mutate its input', () => {
    const events = new SnapshotBuilder()
      .event('b', 0, { eventDate: '2028-02-01' })
      .event('a', 0, {
        eventDate: '2028-01-01',
      })
      .build().events
    sortEvents(events)
    expect(events.map((e) => e.id)).toEqual(['b', 'a'])
  })
})
