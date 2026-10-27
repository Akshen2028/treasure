/**
 * Wedding slugs: the readable part of a wedding's address (`/w/alex-sam`). Mirrored by
 * public.slugify(), public.slug_allowed() and public.slug_blocked() in SQL, which decide the
 * real slug; this copy lets the browser preview and validate one.
 */

/** Room for a numeric suffix within the database's 63-character slug limit. */
export const SLUG_BASE_MAX = 50
/** Used when a name has no letters or digits to build from, or only blocked words. */
export const FALLBACK_SLUG = 'wedding'
/** The database's slug length limits. */
export const SLUG_MIN = 3
export const SLUG_MAX = 63
/** Same rule as the `weddings.slug` check constraint: words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Whole addresses kept for the app, its brand and look-alike official pages. Same list as
 * public.slug_blocked() (a unit test compares them).
 */
export const RESERVED_SLUGS: readonly string[] = [
  'about',
  'account',
  'accounts',
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'billing',
  'blog',
  'create',
  'dashboard',
  'demo',
  'docs',
  'edit',
  'email',
  'example',
  'help',
  'home',
  'login',
  'logout',
  'mail',
  'mywedonomics',
  'new',
  'null',
  'official',
  'planner',
  'privacy',
  'root',
  'search',
  'security',
  'settings',
  'sign-in',
  'sign-up',
  'signin',
  'signup',
  'staff',
  'status',
  'support',
  'system',
  'terms',
  'test',
  'undefined',
  'w',
  'wedonomics',
  'www',
]

/**
 * Offensive words, refused as any hyphen-separated word of an address (so "scunthorpe" stays
 * fine). Same list as public.slug_blocked().
 */
export const BLOCKED_SLUG_WORDS: readonly string[] = [
  'asshole',
  'bastard',
  'bitch',
  'chink',
  'cock',
  'cunt',
  'dyke',
  'fag',
  'faggot',
  'fuck',
  'fucker',
  'fucking',
  'hitler',
  'kike',
  'kkk',
  'nazi',
  'nigga',
  'nigger',
  'porn',
  'pussy',
  'rape',
  'rapist',
  'retard',
  'shit',
  'slut',
  'spic',
  'tranny',
  'wetback',
  'whore',
]

const reserved = new Set(RESERVED_SLUGS)
const blockedWords = new Set(BLOCKED_SLUG_WORDS)

function hasBlockedWord(slug: string): boolean {
  return slug.split('-').some((word) => blockedWords.has(word))
}

/** Whether an address is reserved or offensive, whatever its format. */
export function isSlugBlocked(slug: string): boolean {
  return reserved.has(slug) || hasBlockedWord(slug)
}

/**
 * Lower-case ASCII letters and digits joined by single hyphens: accents are dropped
 * ("Zoë & José" → "zoe-jose"), anything else separates words. Short or reserved results get
 * "-wedding" added ("Al" → "al-wedding"); one with an offensive word becomes "wedding".
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
  if (!slug || hasBlockedWord(slug)) return FALLBACK_SLUG
  if (slug.length < SLUG_MIN || reserved.has(slug)) return `${slug}-${FALLBACK_SLUG}`
  return slug
}

/** The nth candidate for a base slug: the base itself, then `base-2`, `base-3`, … */
export function slugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`
}

/**
 * Why a typed web address can't be used, or null if it can. Expects the input already
 * trimmed and lower-cased; whether it's free is only known when the database saves it.
 */
export function slugError(slug: string): string | null {
  if (!slug) return 'Enter a web address.'
  if (slug.length < SLUG_MIN) return `Use at least ${SLUG_MIN} characters.`
  if (slug.length > SLUG_MAX) return `Keep it to ${SLUG_MAX} characters or fewer.`
  if (!SLUG_PATTERN.test(slug)) {
    return 'Use lower-case letters and numbers, with single hyphens between words.'
  }
  if (isSlugBlocked(slug)) return 'That address isn’t available. Try another.'
  return null
}
