import { describe, expect, it } from 'vitest'

import type { EditChange } from '@/domain/chatTools'
import { selectActive } from '@/domain/hierarchy'
import { deleted, SnapshotBuilder } from '@/domain/testing/factories'
import type { BudgetMode } from '@/domain/types'

import { resolveEdit } from './chatEdits'
import { buildChatRefs } from './chatRefs'

function setup(mode: BudgetMode = 'auto') {
  const snapshot = new SnapshotBuilder(mode)
    .event('Haldi', 0, { eventDate: '2027-06-10' })
    .category('haldi-food', 'Haldi', 'food')
    .activity('Caterer', 'haldi-food', 300000, { actualCostCents: 280000 })
    .payment('p1', 'Caterer', 50000, { note: 'deposit' })
    .definition('decor', 'Decor')
    .event('Old', 0)
    .category('old-food', 'Old', 'food')
    .build()
  snapshot.events[1] = { ...snapshot.events[1]!, ...deleted }
  const active = selectActive(snapshot)
  const { targets, refs } = buildChatRefs(active)
  const resolve = (...changes: EditChange[]) =>
    resolveEdit({ summary: 'Test', changes }, active, targets)
  return { refs, targets, resolve }
}

describe('buildChatRefs', () => {
  it('numbers active records by kind, in display order', () => {
    const { refs } = setup()
    expect(refs.map((r) => `${r.ref} ${r.name}`)).toEqual([
      'D1 Decor',
      'D2 food',
      'E1 Haldi (2027-06-10)',
      'C1 food',
      'A1 Caterer',
      'P1 Payment $500.00 on 2026-09-01 (deposit)',
    ])
  })
})

describe('resolveEdit', () => {
  it('maps refs to ids and describes only what changes', () => {
    const { resolve } = setup()
    const result = resolve({
      op: 'update_activity',
      activity: 'A1',
      budgetCents: 340000,
      status: 'booked',
      name: 'Caterer',
    })
    expect(result.problems).toEqual([])
    expect(result.steps).toEqual([
      {
        step: {
          op: 'update_activity',
          id: 'Caterer',
          patch: { budgetCents: 340000, status: 'booked' },
          before: { budgetCents: 300000, status: 'planned' },
        },
        text: 'Activity “Caterer”: budget $3,000 → $3,400; status Planned → Booked',
      },
    ])
  })

  it('describes payments, deletions and links in plain words', () => {
    const { resolve } = setup()
    const { steps } = resolve(
      {
        op: 'add_payment',
        activity: 'A1',
        amountCents: 125050,
        date: '2026-10-19',
        note: 'balance',
      },
      { op: 'delete', target: 'P1' },
      { op: 'update_activity', activity: 'A1', actualCostCents: null },
    )
    expect(steps.map((s) => s.text)).toEqual([
      'Payment of $1,250.50 on Oct 19, 2026 for “Caterer” (balance)',
      'Delete the $500 payment of Sep 1, 2026 for “Caterer”',
      'Activity “Caterer”: actual cost $2,800 → not set',
    ])
    expect(steps[1]!.step).toEqual({ op: 'delete', kind: 'payment', id: 'p1', label: 'Payment' })
  })

  it('chains records created earlier in the proposal', () => {
    const { resolve } = setup()
    const { steps, problems } = resolve(
      { op: 'create_event', as: 'N1', name: 'Sangeet', date: '2027-06-11' },
      { op: 'add_category', as: 'N2', event: 'N1', definition: null, name: 'Music' },
      { op: 'create_activity', as: null, category: 'N2', name: 'DJ', budgetCents: 80000 },
    )
    expect(problems).toEqual([])
    expect(steps.map((s) => s.step)).toEqual([
      { op: 'create_event', as: 'N1', input: { name: 'Sangeet', eventDate: '2027-06-11' } },
      {
        op: 'add_category',
        as: 'N2',
        event: { created: 'N1' },
        definitionId: null,
        newName: 'Music',
      },
      {
        op: 'create_activity',
        as: null,
        category: { created: 'N2' },
        input: { name: 'DJ', budgetCents: 80000 },
      },
    ])
    expect(steps[2]!.text).toBe('New activity “DJ” in Sangeet › Music: budget $800')
  })

  it('reuses a shared category with the same name and refuses a duplicate in one event', () => {
    const { resolve } = setup()
    const reuse = resolve({
      op: 'add_category',
      as: null,
      event: 'E1',
      definition: null,
      name: ' DECOR ',
    })
    expect(reuse.steps[0]!.step).toMatchObject({ definitionId: 'decor', newName: null })
    const duplicate = resolve({
      op: 'add_category',
      as: null,
      event: 'E1',
      definition: null,
      name: 'food',
    })
    expect(duplicate.problems).toEqual(['Haldi already has food.'])
  })

  it('only accepts level budgets in manual mode, following a mode switch in the proposal', () => {
    const auto = setup('auto').resolve({ op: 'update_event', event: 'E1', budgetCents: 100 })
    expect(auto.problems[0]).toMatch(/manual budget mode/)
    const switched = setup('auto').resolve(
      { op: 'set_budget_mode', mode: 'manual' },
      { op: 'update_event', event: 'E1', budgetCents: 100 },
    )
    expect(switched.problems).toEqual([])
    expect(switched.steps).toHaveLength(2)
  })

  it('refuses a rename that would clash with another shared category', () => {
    const { resolve } = setup()
    expect(resolve({ op: 'update_category', category: 'C1', name: 'decor' }).problems).toEqual([
      'A category called “Decor” already exists.',
    ])
  })

  it('reports records that no longer exist, and proposals that change nothing', () => {
    const { resolve, targets } = setup()
    targets.set('A1', { kind: 'activity', id: 'gone' })
    expect(resolve({ op: 'delete', target: 'A1' }).problems).toEqual([
      'A1 no longer exists. Ask again to refresh.',
    ])
    expect(resolve({ op: 'update_event', event: 'E1', name: 'Haldi' }).problems).toEqual([
      'Nothing to change: it already matches.',
    ])
  })
})
