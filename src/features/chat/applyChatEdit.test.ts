import { describe, expect, it, vi } from 'vitest'

import type { WeddingRepository } from '@/data/repository'
import { SnapshotBuilder } from '@/domain/testing/factories'

import { runEditSteps } from './applyChatEdit'

/** A repository that records calls and hands out sequential ids. */
function fakeRepository(failOn?: string) {
  const calls: string[] = []
  let next = 0
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push(`${name} ${JSON.stringify(args)}`)
      if (name === failOn) throw new Error('refused')
      return { id: `new${++next}` }
    }
  const repository = new Proxy({} as WeddingRepository, {
    get: (_, name: string) => vi.fn(record(name)),
  })
  return { repository, calls }
}

/** Existing records: event e1 › category c1 › activity a1 with payment p1. */
const snapshot = new SnapshotBuilder()
  .event('e1')
  .category('c1', 'e1', 'food')
  .activity('a1', 'c1', 100)
  .payment('p1', 'a1', 50)
  .build()

/** Created records report their parent the way the database returns it. */
function fakeRepositoryWithParents() {
  let next = 0
  const created = (fields: object) => async (input: Record<string, unknown>) => ({
    id: `new${++next}`,
    ...fields,
    ...input,
  })
  return new Proxy({} as WeddingRepository, {
    get: (_, name: string) =>
      name.startsWith('create') ? created({}) : async () => ({ id: 'ignored' }),
  })
}

describe('runEditSteps', () => {
  it('creates records in order, wiring later steps to earlier ones', async () => {
    const { repository, calls } = fakeRepository()
    const result = await runEditSteps(
      repository,
      'w1',
      [
        { op: 'create_event', as: 'N1', input: { name: 'Sangeet' } },
        {
          op: 'add_category',
          as: 'N2',
          event: { created: 'N1' },
          definitionId: 'food',
          newName: null,
        },
        {
          op: 'add_payment',
          activity: { id: 'a1' },
          amountCents: 100,
          paidOn: '2026-10-19',
          note: '',
        },
      ],
      snapshot,
    )
    expect(result).toMatchObject({ applied: 3, total: 3 })
    expect(result.error).toBeUndefined()
    expect(calls).toEqual([
      'createEvent [{"weddingId":"w1","name":"Sangeet"}]',
      'createEventCategory [{"weddingId":"w1","eventId":"new1","categoryDefinitionId":"food"}]',
      'createPayment [{"weddingId":"w1","activityId":"a1","amountCents":100,"paidOn":"2026-10-19","note":""}]',
    ])
  })

  it('undoes newest first: deletions restore, creations are soft-deleted, updates revert', async () => {
    const { repository, calls } = fakeRepository()
    const { undo } = await runEditSteps(
      repository,
      'w1',
      [
        { op: 'update_activity', id: 'a1', patch: { budgetCents: 5 }, before: { budgetCents: 3 } },
        { op: 'add_category', as: null, event: { id: 'e1' }, definitionId: null, newName: 'Music' },
        { op: 'delete', kind: 'payment', id: 'p1', label: 'Payment' },
      ],
      snapshot,
    )
    calls.length = 0
    for (const step of undo) await step()
    expect(calls).toEqual([
      'restore ["payment","p1"]',
      'softDelete ["category","new3"]',
      'softDelete ["definition","new2"]',
      'updateActivity ["a1",{"budgetCents":3}]',
    ])
  })

  it('stops at the first failure and can still undo what was applied', async () => {
    const { repository, calls } = fakeRepository('createPayment')
    const result = await runEditSteps(
      repository,
      'w1',
      [
        { op: 'update_event', id: 'e1', patch: { name: 'B' }, before: { name: 'A' } },
        {
          op: 'add_payment',
          activity: { id: 'a1' },
          amountCents: 100,
          paidOn: '2026-10-19',
          note: '',
        },
        { op: 'delete', kind: 'activity', id: 'a1', label: 'DJ' },
      ],
      snapshot,
    )
    expect(result).toMatchObject({ applied: 1, total: 3 })
    expect(result.error).toBeInstanceOf(Error)
    expect(calls).toHaveLength(2)
    expect(result.undo).toHaveLength(1)
  })

  it.each([
    [
      'a new activity in a new category',
      [
        { op: 'add_category', as: 'N1', event: { id: 'e1' }, definitionId: 'decor', newName: null },
        {
          op: 'create_activity',
          as: null,
          category: { created: 'N1' },
          input: { name: 'Photobooth', budgetCents: 100000 },
        },
      ],
      { kind: 'activity', path: '/events/e1/categories/new1/activities/new2' },
    ],
    [
      'a payment on an existing activity',
      [
        {
          op: 'add_payment',
          activity: { id: 'a1' },
          amountCents: 5,
          paidOn: '2026-10-19',
          note: '',
        },
      ],
      { kind: 'activity', path: '/events/e1/categories/c1/activities/a1' },
    ],
    [
      'an edited payment',
      [{ op: 'update_payment', id: 'p1', patch: { note: 'x' }, before: { note: '' } }],
      { kind: 'activity', path: '/events/e1/categories/c1/activities/a1' },
    ],
    [
      'a deleted activity (shows where it was)',
      [{ op: 'delete', kind: 'activity', id: 'a1', label: 'a1' }],
      { kind: 'category', path: '/events/e1/categories/c1' },
    ],
    [
      'an event edit after an activity edit (the last change wins)',
      [
        { op: 'update_activity', id: 'a1', patch: { name: 'x' }, before: { name: 'a1' } },
        { op: 'update_event', id: 'e1', patch: { name: 'y' }, before: { name: 'e1' } },
      ],
      { kind: 'event', path: '/events/e1' },
    ],
    [
      'a wedding-wide change',
      [{ op: 'update_wedding', id: 'w1', patch: { name: 'x' }, before: { name: 'y' } }],
      null,
    ],
  ] as const)('links to the page for %s', async (_, steps, focus) => {
    const result = await runEditSteps(
      fakeRepositoryWithParents(),
      'w1',
      steps as unknown as Parameters<typeof runEditSteps>[2],
      snapshot,
    )
    expect(result.error).toBeUndefined()
    expect(result.focus).toEqual(focus)
  })
})
