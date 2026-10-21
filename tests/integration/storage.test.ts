/**
 * Media uploads: only a wedding's planners may write to its folder; everyone can view.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createFixture, type Fixture, MEDIA_BUCKET } from './support/fixture'

let f: Fixture

beforeAll(async () => {
  f = await createFixture()
})

afterAll(async () => {
  await f?.cleanup()
})

// Smallest valid PNG: 1×1 transparent pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const path = (weddingId: string, name: string) =>
  `${weddingId}/activities/test/${name}-${crypto.randomUUID()}.png`

describe('media uploads', () => {
  it('rejects uploads from guests', async () => {
    const { error } = await f.guest.storage
      .from(MEDIA_BUCKET)
      .upload(path(f.weddingId, 'guest'), PNG, { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })

  it('rejects uploads from signed-in users who are not planners', async () => {
    const { error } = await f.outsiderClient.storage
      .from(MEDIA_BUCKET)
      .upload(path(f.weddingId, 'outsider'), PNG, { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })

  it('rejects planner uploads to another wedding’s folder or outside any wedding folder', async () => {
    const other = await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(path(f.otherWeddingId, 'cross'), PNG, { contentType: 'image/png' })
    expect(other.error).not.toBeNull()

    const loose = await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(`loose-${crypto.randomUUID()}.png`, PNG, { contentType: 'image/png' })
    expect(loose.error).not.toBeNull()
  })

  it('accepts planner uploads to their wedding, served only through signed URLs', async () => {
    const target = path(f.weddingId, 'planner')
    const { error } = await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(target, PNG, { contentType: 'image/png' })
    expect(error).toBeNull()

    // The bucket is private: the public URL doesn't work, and guests can't sign.
    const { data } = f.guest.storage.from(MEDIA_BUCKET).getPublicUrl(target)
    expect((await fetch(data.publicUrl)).ok).toBe(false)
    const asGuest = await f.guest.storage.from(MEDIA_BUCKET).createSignedUrl(target, 60)
    expect(asGuest.data).toBeNull()
    const asOutsider = await f.outsiderClient.storage.from(MEDIA_BUCKET).createSignedUrl(target, 60)
    expect(asOutsider.data).toBeNull()

    const signed = await f.plannerClient.storage.from(MEDIA_BUCKET).createSignedUrl(target, 60)
    const response = await fetch(signed.data!.signedUrl)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/png')
  })

  it('rejects disallowed file types even for planners', async () => {
    const { error } = await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(
        `${f.weddingId}/activities/test/page.html`,
        Buffer.from('<script>alert(1)</script>'),
        {
          contentType: 'text/html',
        },
      )
    expect(error).not.toBeNull()
  })

  it('enforces the 10 MB limit and image-only types on the bucket itself', async () => {
    // Checking the bucket configuration proves the server-side limit without uploading 10 MB.
    const { data, error } = await f.admin.storage.getBucket(MEDIA_BUCKET)
    expect(error).toBeNull()
    expect(data?.public).toBe(false)
    expect(Number(data?.file_size_limit)).toBe(10 * 1024 * 1024)
    expect([...(data?.allowed_mime_types ?? [])].sort()).toEqual([
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
  })

  it('prevents guests and outsiders from removing media', async () => {
    const target = path(f.weddingId, 'keep')
    await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(target, PNG, { contentType: 'image/png' })

    await f.guest.storage.from(MEDIA_BUCKET).remove([target])
    await f.outsiderClient.storage.from(MEDIA_BUCKET).remove([target])

    const { data } = await f.admin.storage.from(MEDIA_BUCKET).createSignedUrl(target, 60)
    expect((await fetch(data!.signedUrl)).status).toBe(200)
  })

  it('lets planners remove their own wedding’s media', async () => {
    const target = path(f.weddingId, 'remove')
    await f.plannerClient.storage
      .from(MEDIA_BUCKET)
      .upload(target, PNG, { contentType: 'image/png' })
    const { data, error } = await f.plannerClient.storage.from(MEDIA_BUCKET).remove([target])
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })
})
