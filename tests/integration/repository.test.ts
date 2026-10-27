/**
 * SupabaseRepository against the live schema: loading, writing, soft deletion and error
 * translation, with budget totals computed from the loaded snapshot by the domain logic.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RepositoryError, WeddingNotFoundError, type WeddingRepository } from '@/data/repository'
import { createSupabaseRepository } from '@/data/supabase/SupabaseRepository'
import { computeBudgetIndex } from '@/domain/budget'
import { selectActive } from '@/domain/hierarchy'

import { createFixture, type Fixture } from './support/fixture'

let f: Fixture
let planner: WeddingRepository
let guest: WeddingRepository

beforeAll(async () => {
  f = await createFixture({ signIn: ['planner'] })
  planner = createSupabaseRepository(f.plannerClient)
  guest = createSupabaseRepository(f.guest)
})

afterAll(async () => {
  await f?.cleanup()
})

describe('loadSnapshot', () => {
  it('loads the whole wedding as domain objects', async () => {
    const snapshot = await planner.loadSnapshot(f.weddingSlug)
    expect(snapshot.wedding).toMatchObject({ id: f.weddingId, budgetMode: 'auto' })
    expect(snapshot.categoryDefinitions).toHaveLength(7)
    expect(snapshot.events.map((e) => e.id)).toContain(f.eventId)
    expect(snapshot.activities[0]).toMatchObject({ budgetCents: 150_000, actualCostCents: null })
    expect(snapshot.payments[0]).toMatchObject({ amountCents: 50_000, paidOn: '2026-09-01' })
  })

  it('never mixes in another wedding’s records', async () => {
    const snapshot = await guest.loadGuestView(f.weddingSlug, f.weddingShareKey)
    expect(snapshot.events.some((e) => e.id === f.otherEventId)).toBe(false)
    expect(snapshot.activities.some((a) => a.id === f.otherActivityId)).toBe(false)
  })

  it('throws WeddingNotFoundError for an unknown slug', async () => {
    await expect(planner.loadSnapshot('test-does-not-exist')).rejects.toBeInstanceOf(
      WeddingNotFoundError,
    )
  })
})

describe('planner writes through the repository', () => {
  it('builds a full event tree and the budget rolls up from it', async () => {
    const event = await planner.createEvent({
      weddingId: f.weddingId,
      name: 'Sangeet',
      eventDate: '2028-06-29',
      location: 'Toronto',
    })
    const definition = await planner.createCategoryDefinition({
      weddingId: f.weddingId,
      name: `Choreographer ${crypto.randomUUID().slice(0, 6)}`,
    })
    const category = await planner.createEventCategory({
      weddingId: f.weddingId,
      eventId: event.id,
      categoryDefinitionId: definition.id,
    })
    const activity = await planner.createActivity({
      weddingId: f.weddingId,
      eventCategoryId: category.id,
      name: 'Dance lessons',
      budgetCents: 200_000,
      status: 'planned',
    })
    await planner.createPayment({
      weddingId: f.weddingId,
      activityId: activity.id,
      amountCents: 75_000,
      paidOn: '2026-10-01',
      note: 'First half',
    })
    const link = await planner.createActivityLink({
      weddingId: f.weddingId,
      activityId: activity.id,
      url: 'https://example.com/studio',
      label: 'Studio',
    })
    expect(link.label).toBe('Studio')

    const budget = computeBudgetIndex(await planner.loadSnapshot(f.weddingSlug))
    expect(budget.events.get(event.id)).toMatchObject({ budgetCents: 200_000, paidCents: 75_000 })

    await planner.updateActivity(activity.id, { budgetCents: 260_000, actualCostCents: 240_000 })
    const after = computeBudgetIndex(await planner.loadSnapshot(f.weddingSlug))
    expect(after.categories.get(category.id)?.budgetCents).toBe(260_000)
    expect(after.activities.get(activity.id)?.outstandingCents).toBe(165_000)
  })

  it('switches the wedding to manual budgets', async () => {
    const wedding = await planner.updateWedding(f.weddingId, {
      budgetMode: 'manual',
      manualBudgetCents: 9_000_000,
    })
    expect(wedding).toMatchObject({ budgetMode: 'manual', manualBudgetCents: 9_000_000 })
    const budget = computeBudgetIndex(await planner.loadSnapshot(f.weddingSlug))
    expect(budget.wedding.budgetCents).toBe(9_000_000)
    await planner.updateWedding(f.weddingId, { budgetMode: 'auto' })
  })

  it('soft-deletes and restores, with planners seeing deleted records and guests not', async () => {
    await planner.softDelete('event', f.eventId)

    const plannerView = await planner.loadSnapshot(f.weddingSlug)
    expect(plannerView.events.find((e) => e.id === f.eventId)?.deletedAt).not.toBeNull()
    expect(selectActive(plannerView).activities.some((a) => a.id === f.activityId)).toBe(false)

    const guestView = await guest.loadGuestView(f.weddingSlug, f.weddingShareKey)
    expect(guestView.events.some((e) => e.id === f.eventId)).toBe(false)

    await planner.restore('event', f.eventId)
    const restored = await guest.loadGuestView(f.weddingSlug, f.weddingShareKey)
    expect(selectActive(restored).activities.some((a) => a.id === f.activityId)).toBe(true)
  })
})

describe('errors are translated for the UI', () => {
  it('reports guest writes as forbidden', async () => {
    const error = await guest
      .createEvent({ weddingId: f.weddingId, name: 'Nope' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).reason).toBe('forbidden')
  })

  it('reports a duplicate category as a conflict', async () => {
    const error = await planner
      .createEventCategory({
        weddingId: f.weddingId,
        eventId: f.eventId,
        categoryDefinitionId: f.categoryDefinitionId,
      })
      .catch((e: unknown) => e)
    expect((error as RepositoryError).reason).toBe('conflict')
  })

  it('reports invalid values', async () => {
    const error = await planner
      .updatePayment(f.paymentId, { amountCents: 0 })
      .catch((e: unknown) => e)
    expect((error as RepositoryError).reason).toBe('invalid')
  })

  it('reports another wedding’s records as not found', async () => {
    const error = await planner
      .updateActivity(f.otherActivityId, { name: 'Hijack' })
      .catch((e: unknown) => e)
    expect((error as RepositoryError).reason).toBe('not-found')

    const deletion = await planner
      .softDelete('activity', f.otherActivityId)
      .catch((e: unknown) => e)
    expect((deletion as RepositoryError).reason).toBe('not-found')
  })
})
