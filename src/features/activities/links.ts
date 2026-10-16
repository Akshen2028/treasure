/**
 * External links on activities (vendor sites, quotes, inspiration). The database accepts only
 * http(s) URLs; this normalises what people paste and suggests a label.
 */

export type LinkFormResult = { url: string; label: string }

/** Adds https:// when missing; returns null if it isn't a usable web address. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString().length > 2048 ? null : url.toString()
  } catch {
    return null
  }
}

/** "www.example.com/quote" → "example.com". */
export function linkLabelFallback(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function parseLinkForm(
  urlInput: string,
  labelInput: string,
): { ok: true; value: LinkFormResult } | { ok: false; errors: { url?: string; label?: string } } {
  const url = normalizeUrl(urlInput)
  const label = labelInput.trim()
  const errors: { url?: string; label?: string } = {}
  if (!url) errors.url = 'Enter a web address like example.com/quote.'
  if (label.length > 200) errors.label = 'Keep the label under 200 characters.'
  if (!url || errors.label) return { ok: false, errors }
  return { ok: true, value: { url, label } }
}
