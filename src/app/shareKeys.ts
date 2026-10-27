/**
 * Remembers the share key a private wedding was opened with (`?k=`), per slug, so moving
 * between screens or reloading keeps it open. A convenience, not a credential store: the
 * database checks the key on every read, and anyone holding the link already has it.
 */
const PREFIX = 'wedonomics.share.'

/** Share keys are server-generated hex; anything else can't open a wedding, so ignore it. */
export function isShareKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{16,128}$/i.test(value)
}

export function readShareKey(slug: string): string | null {
  try {
    const value = window.localStorage.getItem(PREFIX + slug)
    return isShareKey(value) ? value : null
  } catch {
    return null
  }
}

export function saveShareKey(slug: string, key: string) {
  try {
    window.localStorage.setItem(PREFIX + slug, key)
  } catch {
    // Without storage the key still works for this page; links to other screens may not.
  }
}
