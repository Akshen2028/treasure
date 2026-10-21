/**
 * Photos through the repository: upload + record, cleanup on failure, cover photos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type PreparedImage, RepositoryError, type WeddingRepository } from '@/data/repository'
import { createSupabaseRepository, MEDIA_BUCKET } from '@/data/supabase/SupabaseRepository'

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

// Smallest valid PNG: 1×1 transparent pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const image = (): PreparedImage => ({
  full: { blob: new Blob([PNG], { type: 'image/png' }), mimeType: 'image/png' },
  thumb: { blob: new Blob([PNG], { type: 'image/png' }), mimeType: 'image/png' },
  width: 1,
  height: 1,
})

async function objectExists(path: string) {
  const folder = path.slice(0, path.lastIndexOf('/'))
  const name = path.slice(path.lastIndexOf('/') + 1)
  const { data } = await f.admin.storage.from(MEDIA_BUCKET).list(folder, { search: name })
  return (data ?? []).some((o) => o.name === name)
}

describe('activity photos', () => {
  it('uploads the photo and thumbnail, records them, and serves them to planners signed', async () => {
    const saved = await planner.addActivityImage({
      weddingId: f.weddingId,
      activityId: f.activityId,
      image: image(),
    })
    expect(saved.storagePath).toMatch(new RegExp(`^${f.weddingId}/activities/${f.activityId}/`))
    expect(saved.thumbnailPath).toMatch(/-thumb\.png$/)
    expect(saved).toMatchObject({ mimeType: 'image/png', width: 1, height: 1 })

    const urls = await planner.signMedia({
      audience: 'planner',
      slug: f.weddingSlug,
      shareKey: null,
      paths: [saved.storagePath, saved.thumbnailPath!],
    })
    expect(Object.keys(urls).sort()).toEqual([saved.storagePath, saved.thumbnailPath!].sort())
    const response = await fetch(urls[saved.storagePath]!)
    expect(response.status).toBe(200)

    const snapshot = await guest.loadGuestView(f.weddingSlug, f.weddingShareKey)
    expect(snapshot.activityImages.some((i) => i.id === saved.id)).toBe(true)
  })

  it('removes uploaded files if the record cannot be saved', async () => {
    // The other wedding's activity fails the same-wedding foreign key after the upload.
    const before = await f.admin.storage
      .from(MEDIA_BUCKET)
      .list(`${f.weddingId}/activities/${f.otherActivityId}`)
    const error = await planner
      .addActivityImage({ weddingId: f.weddingId, activityId: f.otherActivityId, image: image() })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RepositoryError)
    const after = await f.admin.storage
      .from(MEDIA_BUCKET)
      .list(`${f.weddingId}/activities/${f.otherActivityId}`)
    expect(after.data?.length ?? 0).toBe(before.data?.length ?? 0)
  })

  it('refuses uploads from guests', async () => {
    const error = await guest
      .addActivityImage({ weddingId: f.weddingId, activityId: f.activityId, image: image() })
      .catch((e: unknown) => e)
    expect((error as RepositoryError).reason).toBe('forbidden')
  })

  it('soft-deletes a photo without removing the file, so it can be restored', async () => {
    const saved = await planner.addActivityImage({
      weddingId: f.weddingId,
      activityId: f.activityId,
      image: image(),
    })
    await planner.softDelete('image', saved.id)
    const guestView = await guest.loadGuestView(f.weddingSlug, f.weddingShareKey)
    expect(guestView.activityImages.some((i) => i.id === saved.id)).toBe(false)
    expect(await objectExists(saved.storagePath)).toBe(true)
    await planner.restore('image', saved.id)
  })
})

describe('event cover photos', () => {
  it('sets, replaces (removing the old file) and removes a cover', async () => {
    const first = await planner.setEventCover({
      weddingId: f.weddingId,
      eventId: f.eventId,
      image: image(),
    })
    const firstPath = first.coverImagePath!
    expect(firstPath).toMatch(new RegExp(`^${f.weddingId}/events/${f.eventId}/`))
    expect(await objectExists(firstPath)).toBe(true)

    const second = await planner.setEventCover({
      weddingId: f.weddingId,
      eventId: f.eventId,
      image: image(),
    })
    expect(second.coverImagePath).not.toBe(firstPath)
    expect(await objectExists(firstPath)).toBe(false)

    const removed = await planner.setEventCover({
      weddingId: f.weddingId,
      eventId: f.eventId,
      image: null,
    })
    expect(removed.coverImagePath).toBeNull()
    expect(await objectExists(second.coverImagePath!)).toBe(false)
  })
})
