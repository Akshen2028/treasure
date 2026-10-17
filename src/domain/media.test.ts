import { describe, expect, it } from 'vitest'

import {
  activityImagePaths,
  checkSourceFile,
  eventCoverPath,
  fitWithin,
  MAX_SOURCE_BYTES,
} from './media'

const MB = 1024 * 1024

describe('checkSourceFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])(
    'accepts %s',
    (type) => {
      expect(checkSourceFile({ name: 'photo', type, size: 5 * MB })).toEqual({ ok: true })
    },
  )

  it.each(['application/pdf', 'image/svg+xml', 'video/mp4', ''])('rejects %j', (type) => {
    expect(checkSourceFile({ name: 'file', type, size: 1000 })).toMatchObject({ ok: false })
  })

  it('rejects originals that are too large to process', () => {
    expect(
      checkSourceFile({ name: 'huge.jpg', type: 'image/jpeg', size: MAX_SOURCE_BYTES + 1 }),
    ).toMatchObject({
      ok: false,
    })
  })

  it('limits GIFs to the stored size, since they are uploaded unchanged', () => {
    expect(checkSourceFile({ name: 'a.gif', type: 'image/gif', size: 11 * MB })).toMatchObject({
      ok: false,
    })
    expect(checkSourceFile({ name: 'a.gif', type: 'image/gif', size: 9 * MB })).toEqual({
      ok: true,
    })
  })
})

describe('fitWithin', () => {
  it('scales the longest edge down, keeping the aspect ratio', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 })
    expect(fitWithin(3024, 4032, 480)).toEqual({ width: 360, height: 480 })
  })

  it('never scales up', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 })
  })
})

describe('storage paths', () => {
  it('start with the wedding id, as storage rules require', () => {
    expect(activityImagePaths('w1', 'a1', 'x', 'image/gif', 'image/webp')).toEqual({
      full: 'w1/activities/a1/x.gif',
      thumb: 'w1/activities/a1/x-thumb.webp',
    })
    expect(eventCoverPath('w1', 'e1', 'y', 'image/jpeg')).toBe('w1/events/e1/y.jpg')
  })
})
