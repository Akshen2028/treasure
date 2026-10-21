/**
 * Wedding slugs: the readable part of a wedding's address (`/w/alex-sam`). Mirrored by
 * public.slugify() in SQL, which assigns the real slug in create_my_wedding(); this copy lets
 * the browser preview and validate one.
 */

/** Room for a numeric suffix within the database's 63-character slug limit. */
export const SLUG_BASE_MAX = 50
/** Used when a name has no letters or digits to build from. */
export const FALLBACK_SLUG = 'wedding'
/** Same rule as the `weddings.slug` check constraint. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * Lower-case ASCII letters and digits joined by single hyphens: accents are dropped
 * ("Zoë & José" → "zoe-jose"), anything else separates words.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX)
    .replace(/-+$/, '')
  return slug || FALLBACK_SLUG
}

/** The nth candidate for a base slug: the base itself, then `base-2`, `base-3`, … */
export function slugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`
}
