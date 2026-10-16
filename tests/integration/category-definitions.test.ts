/**
 * Deleting custom categories: allowed only when unused, enforced by the database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RepositoryError, type WeddingRepository } from '@/data/repository'
import { createSupabaseRepository } from '@/data/supabase/SupabaseRepository'
import { selectActive } from '@/domain/hierarchy'

import { createFixture, type Fixture } from './support/fixture'

let f: Fixture
let planner: WeddingRepository
let guest: WeddingRepository

beforeAll(async () => {
  f = await createFixture()
  planner = createSupabaseRepository(f.plannerClient)
  guest = createSupabaseRepository(f.guest)
})

afterAll(async () => {
  await f?.cleanup()
})

const reasonOf = (e: unknown) => (e as RepositoryError).reason
const unique = () => crypto.randomUUID().slice(0, 6)

describe('deleting custom categories', () => {
  it('deletes an unused custom category, hiding it from guests and freeing its name', async () => {
    const name = `Florist ${unique()}`
    const definition = await planner.createCategoryDefinition({ weddingId: f.weddingId, name })
    await planner.softDelete('definition', definition.id)

    const guestView = await guest.loadSnapshot(f.weddingSlug)
    expect(guestView.categoryDefinitions.some((d) => d.id === definition.id)).toBe(false)
    const plannerView = await planner.loadSnapshot(f.weddingSlug)
    expect(
      plannerView.categoryDefinitions.find((d) => d.id === definition.id)?.deletedAt,
    ).not.toBeNull()

    const again = await planner.createCategoryDefinition({ weddingId: f.weddingId, name })
    expect(again.id).not.toBe(definition.id)
  })

  it('refuses to delete a default category', async () => {
    const error = await planner.softDelete('definition', f.categoryDefinitionId).catch((e) => e)
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).message).toMatch(/Default categories cannot be deleted/)
  })

  it('refuses to delete a category used by an event, even a deleted event', async () => {
    const definition = await planner.createCategoryDefinition({
      weddingId: f.weddingId,
      name: `Caricaturist ${unique()}`,
    })
    const event = await planner.createEvent({ weddingId: f.weddingId, name: 'Haldi' })
    await planner.createEventCategory({
      weddingId: f.weddingId,
      eventId: event.id,
      categoryDefinitionId: definition.id,
    })

    const inUse = await planner.softDelete('definition', definition.id).catch((e) => e)
    expect(reasonOf(inUse)).toBe('invalid')
    expect((inUse as RepositoryError).message).toMatch(/still used by an event/)

    await planner.softDelete('event', event.id)
    const underDeletedEvent = await planner.softDelete('definition', definition.id).catch((e) => e)
    expect(reasonOf(underDeletedEvent)).toBe('invalid')
  })

  it('refuses to add a deleted category to an event', async () => {
    const definition = await planner.createCategoryDefinition({
      weddingId: f.weddingId,
      name: `Calligrapher ${unique()}`,
    })
    await planner.softDelete('definition', definition.id)
    const error = await planner
      .createEventCategory({
        weddingId: f.weddingId,
        eventId: f.eventId,
        categoryDefinitionId: definition.id,
      })
      .catch((e) => e)
    expect((error as RepositoryError).message).toMatch(/has been deleted/)
  })

  it('restoring an event category brings back its deleted shared category', async () => {
    const definition = await planner.createCategoryDefinition({
      weddingId: f.weddingId,
      name: `Henna ${unique()}`,
    })
    const category = await planner.createEventCategory({
      weddingId: f.weddingId,
      eventId: f.eventId,
      categoryDefinitionId: definition.id,
    })
    await planner.softDelete('category', category.id)
    await planner.softDelete('definition', definition.id)

    await planner.restore('category', category.id)
    const snapshot = await planner.loadSnapshot(f.weddingSlug)
    expect(snapshot.categoryDefinitions.find((d) => d.id === definition.id)?.deletedAt).toBeNull()
    expect(selectActive(snapshot).eventCategories.some((c) => c.id === category.id)).toBe(true)
  })

  it('does not let guests or outsiders delete categories', async () => {
    const definition = await planner.createCategoryDefinition({
      weddingId: f.weddingId,
      name: `Guest test ${unique()}`,
    })
    const asGuest = await guest.softDelete('definition', definition.id).catch((e) => e)
    expect(reasonOf(asGuest)).toBe('forbidden')
    const asOutsider = await createSupabaseRepository(f.outsiderClient)
      .softDelete('definition', definition.id)
      .catch((e) => e)
    expect(reasonOf(asOutsider)).toBe('not-found')
  })
})
