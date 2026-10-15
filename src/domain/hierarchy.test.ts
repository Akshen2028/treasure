import { describe, expect, it } from 'vitest'

import { findCategoryRestoreConflict, listDeletedItems, selectActive } from './hierarchy'
import { deleted, SnapshotBuilder, withChange } from './testing/factories'
import type { Payment, WeddingSnapshot } from './types'

const paymentLabel = (p: Payment) => `${p.amountCents}¢`

const base = () =>
  new SnapshotBuilder()
    .event('reception')
    .category('r-decor', 'reception', 'decor')
    .activity('lighting', 'r-decor', 80_000)
    .activity('florals', 'r-decor', 120_000)
    .payment('p1', 'lighting', 30_000)
    .payment('p2', 'florals', 40_000)
    .event('mehndi')
    .category('m-food', 'mehndi', 'food')
    .activity('caterer', 'm-food', 400_000)
    .build()

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id).sort()

describe('selectActive', () => {
  it('keeps everything when nothing is deleted', () => {
    const s = base()
    const active = selectActive(s)
    expect(ids(active.events)).toEqual(['mehndi', 'reception'])
    expect(ids(active.payments)).toEqual(['p1', 'p2'])
  })

  it('hides descendants of a deleted event without modifying them', () => {
    const s = withChange(base(), 'events', 'reception', deleted)
    const active = selectActive(s)
    expect(ids(active.events)).toEqual(['mehndi'])
    expect(ids(active.eventCategories)).toEqual(['m-food'])
    expect(ids(active.activities)).toEqual(['caterer'])
    expect(active.payments).toEqual([])
    // The children themselves are untouched.
    expect(s.activities.find((a) => a.id === 'lighting')?.deletedAt).toBeNull()
  })

  it('hides payments under a deleted activity', () => {
    const active = selectActive(withChange(base(), 'activities', 'lighting', deleted))
    expect(ids(active.payments)).toEqual(['p2'])
  })

  it('hides images and links of a deleted activity', () => {
    const s: WeddingSnapshot = {
      ...base(),
      activityLinks: [
        {
          id: 'l1',
          activityId: 'lighting',
          url: 'https://example.com',
          label: 'Quote',
          sortOrder: 0,
          deletedAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    }
    expect(selectActive(s).activityLinks).toHaveLength(1)
    expect(selectActive(withChange(s, 'activities', 'lighting', deleted)).activityLinks).toEqual([])
  })
})

describe('listDeletedItems', () => {
  it('is empty when nothing is deleted', () => {
    expect(listDeletedItems(base(), paymentLabel)).toEqual([])
  })

  it('lists each deleted record with its context, newest first', () => {
    let s = withChange(base(), 'payments', 'p1', { deletedAt: '2026-10-01T00:00:00Z' })
    s = withChange(s, 'activities', 'florals', { deletedAt: '2026-10-03T00:00:00Z' })
    s = withChange(s, 'eventCategories', 'm-food', { deletedAt: '2026-10-02T00:00:00Z' })
    const items = listDeletedItems(s, paymentLabel)

    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ['activity', 'florals'],
      ['category', 'm-food'],
      ['payment', 'p1'],
    ])
    expect(items[0]).toMatchObject({
      label: 'florals',
      context: ['reception', 'decor'],
      hiddenBy: null,
    })
    expect(items[1]).toMatchObject({ label: 'food', context: ['mehndi'], hiddenBy: null })
    expect(items[2]).toMatchObject({
      label: '30000¢',
      context: ['reception', 'decor', 'lighting'],
      hiddenBy: null,
    })
  })

  it('reports the nearest deleted ancestor that keeps an item hidden', () => {
    let s = withChange(base(), 'payments', 'p2', deleted)
    s = withChange(s, 'activities', 'florals', deleted)
    s = withChange(s, 'events', 'reception', deleted)
    const items = listDeletedItems(s, paymentLabel)
    const byId = new Map(items.map((i) => [i.id, i]))

    expect(byId.get('reception')?.hiddenBy).toBeNull()
    expect(byId.get('florals')?.hiddenBy).toEqual({
      kind: 'event',
      id: 'reception',
      label: 'reception',
    })
    expect(byId.get('p2')?.hiddenBy).toEqual({ kind: 'activity', id: 'florals', label: 'florals' })
  })

  it('does not list children that are only hidden because a parent was deleted', () => {
    const s = withChange(base(), 'events', 'reception', deleted)
    expect(listDeletedItems(s, paymentLabel).map((i) => i.id)).toEqual(['reception'])
  })
})

describe('findCategoryRestoreConflict', () => {
  it('allows restoring when the category is not active elsewhere in the event', () => {
    const s = withChange(base(), 'eventCategories', 'r-decor', deleted)
    expect(findCategoryRestoreConflict(s, 'r-decor')).toBeNull()
  })

  it('refuses restoring when the same category was re-added to the event', () => {
    const builder = new SnapshotBuilder()
      .event('reception')
      .category('old-decor', 'reception', 'decor', 0, deleted)
      .category('new-decor', 'reception', 'decor')
    expect(findCategoryRestoreConflict(builder.build(), 'old-decor')?.id).toBe('new-decor')
  })

  it('ignores the same category in a different event', () => {
    const s = new SnapshotBuilder()
      .event('reception')
      .category('r-decor', 'reception', 'decor', 0, deleted)
      .event('mehndi')
      .category('m-decor', 'mehndi', 'decor')
      .build()
    expect(findCategoryRestoreConflict(s, 'r-decor')).toBeNull()
  })
})
