/**
 * Random v4 UUID for naming uploaded files.
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost), so it is missing
 * when the app is opened over plain http on a local network address, e.g. testing on a phone.
 * `crypto.getRandomValues()` works everywhere, so the UUID is built from it as a fallback.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
