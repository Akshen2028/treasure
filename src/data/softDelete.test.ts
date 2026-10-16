import { describe, expect, it } from 'vitest'

import { deleted, SnapshotBuilder } from '@/domain/testing/factories'

import { withDeletedAt } from './softDelete'

describe('withDeletedAt', () => {
  const snapshot = new SnapshotBuilder()
    .event('e1')
    .event('e2')
    .category('c1', 'e1', 'food', 0, deleted)
    .build()

  it('changes only the targeted record and leaves the original untouched', () => {
    const next = withDeletedAt(snapshot, { kind: 'event', id: 'e1' }, '2026-10-20T00:00:00Z')
    expect(next.events.find((e) => e.id === 'e1')?.deletedAt).toBe('2026-10-20T00:00:00Z')
    expect(next.events.find((e) => e.id === 'e2')?.deletedAt).toBeNull()
    expect(snapshot.events.find((e) => e.id === 'e1')?.deletedAt).toBeNull()
  })

  it('clears deletion for restore', () => {
    const next = withDeletedAt(snapshot, { kind: 'category', id: 'c1' }, null)
    expect(next.eventCategories[0]?.deletedAt).toBeNull()
  })
})
