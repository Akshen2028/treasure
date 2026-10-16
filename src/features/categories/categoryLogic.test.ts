import { describe, expect, it } from 'vitest'

import { selectActive } from '@/domain/hierarchy'
import { deleted, SnapshotBuilder } from '@/domain/testing/factories'

import {
  activityCount,
  categoriesForEvent,
  deletableDefinitionIds,
  findDefinitionByName,
  libraryForEvent,
  normalizeCategoryName,
  otherEventsUsing,
  parseManualBudget,
  sortDefinitions,
  validateCategoryName,
} from './categoryLogic'

const snapshot = () =>
  new SnapshotBuilder()
    .definition('food', 'Food', { isDefault: true, sortOrder: 1 })
    .definition('decor', 'Decor', { isDefault: true, sortOrder: 2 })
    .definition('venue', 'Venue', { isDefault: true, sortOrder: 4 })
    .definition('mehndi-artist', 'Mehndi Artist')
    .definition('cake', 'cake')
    .event('mehndi')
    .event('reception')
    .event('haldi', 0, deleted)
    .category('m-decor', 'mehndi', 'decor', 0, { sortOrder: 2 })
    .category('m-artist', 'mehndi', 'mehndi-artist', 0, { sortOrder: 1 })
    .category('m-food-old', 'mehndi', 'food', 0, deleted)
    .category('r-decor', 'reception', 'decor')
    .category('h-decor', 'haldi', 'decor')
    .activity('a1', 'm-decor', 100)
    .activity('a2', 'm-decor', 100)
    .activity('a3', 'm-decor', 100, deleted)
    .build()

describe('category library', () => {
  it('lists defaults in their set order, then custom categories alphabetically', () => {
    const names = sortDefinitions(snapshot().categoryDefinitions).map((d) => d.name)
    expect(names).toEqual(['Food', 'Decor', 'Venue', 'cake', 'Mehndi Artist'])
  })

  it('marks categories already active in the event; deleted ones are available again', () => {
    const options = libraryForEvent(selectActive(snapshot()), 'mehndi')
    const inEvent = options.filter((o) => o.inThisEvent).map((o) => o.definition.id)
    expect(inEvent.sort()).toEqual(['decor', 'mehndi-artist'])
    expect(options.find((o) => o.definition.id === 'food')?.inThisEvent).toBe(false)
  })

  it('matches names ignoring case and spacing, so existing categories are reused', () => {
    expect(normalizeCategoryName('  Mehndi   ARTIST ')).toBe('mehndi artist')
    expect(findDefinitionByName(snapshot().categoryDefinitions, ' decor ')?.id).toBe('decor')
    expect(findDefinitionByName(snapshot().categoryDefinitions, 'Florist')).toBeUndefined()
  })
})

describe('categories for an event', () => {
  it('lists active categories in sort order with their names', () => {
    const list = categoriesForEvent(selectActive(snapshot()), 'mehndi')
    expect(list.map((c) => c.definition.name)).toEqual(['Mehndi Artist', 'Decor'])
  })

  it('finds other active events sharing the category', () => {
    const others = otherEventsUsing(selectActive(snapshot()), 'decor', 'mehndi')
    expect(others.map((o) => o.event.id)).toEqual(['reception'])
  })

  it('counts only active activities', () => {
    expect(activityCount(selectActive(snapshot()), 'm-decor')).toBe(2)
  })
})

describe('form helpers', () => {
  it('validates category names like the database', () => {
    expect(validateCategoryName('  ')).toBeDefined()
    expect(validateCategoryName('x'.repeat(61))).toBeDefined()
    expect(validateCategoryName(' Florist ')).toBeUndefined()
  })

  it('parses the manual budget only in manual mode', () => {
    expect(parseManualBudget('oops', 'auto')).toEqual({ ok: true, cents: undefined })
    expect(parseManualBudget('', 'manual')).toEqual({ ok: true, cents: 0 })
    expect(parseManualBudget('2,500', 'manual')).toEqual({ ok: true, cents: 250_000 })
    expect(parseManualBudget('1.234', 'manual')).toMatchObject({ ok: false })
  })
})

describe('deletable custom categories', () => {
  const build = () =>
    new SnapshotBuilder()
      .definition('food', 'Food', { isDefault: true })
      .definition('unused', 'Florist')
      .definition('used', 'Mehndi Artist')
      .definition('under-deleted-event', 'Caricaturist')
      .definition('only-removed', 'Calligrapher')
      .event('mehndi')
      .event('haldi', 0, deleted)
      .category('c1', 'mehndi', 'used')
      .category('c2', 'haldi', 'under-deleted-event')
      .category('c3', 'mehndi', 'only-removed', 0, deleted)
      .build()

  it('allows only unused custom categories', () => {
    expect([...deletableDefinitionIds(build())].sort()).toEqual(['only-removed', 'unused'])
  })

  it('never offers defaults, even when unused', () => {
    expect(deletableDefinitionIds(build()).has('food')).toBe(false)
  })

  it('treats a category under a deleted event as still in use', () => {
    expect(deletableDefinitionIds(build()).has('under-deleted-event')).toBe(false)
  })
})
