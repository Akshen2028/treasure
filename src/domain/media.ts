/**
 * Rules for photos. Pure functions so they can be tested without a browser.
 *
 * Photos are resized in the browser before upload: phones produce 5–15 MB images, and a
 * 2048px WebP/JPEG is ~300–800 KB while still looking sharp full-screen.
 */

/** What the storage bucket accepts (it enforces this server-side too). */
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number]

/** Bucket limit for a single stored file. */
export const MAX_STORED_BYTES = 10 * 1024 * 1024
/** Largest original we'll try to process; it gets resized well below the stored limit. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024

export const FULL_MAX_EDGE = 2048
export const THUMB_MAX_EDGE = 480

/** Formats a browser may hand us that it can usually decode, even if we store something else. */
const DECODABLE = /^image\/(jpeg|png|webp|gif|heic|heif|avif|bmp)$/

export type FileCheck = { ok: true } | { ok: false; reason: string }

export function checkSourceFile(file: { name: string; type: string; size: number }): FileCheck {
  if (!DECODABLE.test(file.type)) {
    return {
      ok: false,
      reason: `${file.name} isn’t a supported photo. Use JPEG, PNG, WebP or GIF.`,
    }
  }
  if (file.type === 'image/gif' && file.size > MAX_STORED_BYTES) {
    return { ok: false, reason: `${file.name} is too large. GIFs must be under 10 MB.` }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, reason: `${file.name} is too large. Photos must be under 40 MB.` }
  }
  return { ok: true }
}

/** Scales dimensions down to fit within `maxEdge`, never up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export const extensionFor = (mime: UploadMimeType) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[mime]

/**
 * Storage paths always start with the wedding id; the database and storage rules require it.
 * e.g. {wedding}/activities/{activity}/{uuid}.webp and …/{uuid}-thumb.webp
 */
export function activityImagePaths(
  weddingId: string,
  activityId: string,
  id: string,
  fullMime: UploadMimeType,
  thumbMime: UploadMimeType,
) {
  const base = `${weddingId}/activities/${activityId}/${id}`
  return {
    full: `${base}.${extensionFor(fullMime)}`,
    thumb: `${base}-thumb.${extensionFor(thumbMime)}`,
  }
}

export function eventCoverPath(
  weddingId: string,
  eventId: string,
  id: string,
  mime: UploadMimeType,
) {
  return `${weddingId}/events/${eventId}/${id}.${extensionFor(mime)}`
}
