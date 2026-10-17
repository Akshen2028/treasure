/**
 * Turns a picked photo into upload-ready files in the browser: corrects phone orientation,
 * resizes, re-encodes as WebP (JPEG where the browser can't encode WebP), and makes a
 * thumbnail. GIFs are kept as-is so animation survives; only their thumbnail is generated.
 */
import type { PreparedImage } from '@/data/repository'

import {
  FULL_MAX_EDGE,
  MAX_STORED_BYTES,
  THUMB_MAX_EDGE,
  type UploadMimeType,
  checkSourceFile,
  fitWithin,
} from '@/domain/media'

export class ImagePrepError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImagePrepError'
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  } catch {
    // Some browsers can only decode certain formats (e.g. HEIC on Safari) through <img>.
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      }
    } catch {
      URL.revokeObjectURL(url)
      throw new ImagePrepError(`${file.name} couldn’t be read. Try a JPEG or PNG.`)
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Draws the image at the given size and encodes it, preferring WebP. */
async function encode(
  decoded: Decoded,
  maxEdge: number,
): Promise<{ blob: Blob; mimeType: UploadMimeType; width: number; height: number }> {
  const { width, height } = fitWithin(decoded.width, decoded.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new ImagePrepError('This browser can’t process photos.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(decoded.source, 0, 0, width, height)

  const webp = await toBlob(canvas, 'image/webp', 0.85)
  if (webp && webp.type === 'image/webp')
    return { blob: webp, mimeType: 'image/webp', width, height }
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!jpeg) throw new ImagePrepError('This photo couldn’t be processed.')
  return { blob: jpeg, mimeType: 'image/jpeg', width, height }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const check = checkSourceFile(file)
  if (!check.ok) throw new ImagePrepError(check.reason)

  const decoded = await decode(file)
  try {
    const thumb = await encode(decoded, THUMB_MAX_EDGE)
    if (file.type === 'image/gif') {
      return {
        full: { blob: file, mimeType: 'image/gif' },
        thumb: { blob: thumb.blob, mimeType: thumb.mimeType },
        width: decoded.width,
        height: decoded.height,
      }
    }
    const full = await encode(decoded, FULL_MAX_EDGE)
    if (full.blob.size > MAX_STORED_BYTES) {
      throw new ImagePrepError(`${file.name} is still too large after resizing.`)
    }
    return {
      full: { blob: full.blob, mimeType: full.mimeType },
      thumb: { blob: thumb.blob, mimeType: thumb.mimeType },
      width: full.width,
      height: full.height,
    }
  } finally {
    decoded.close()
  }
}
