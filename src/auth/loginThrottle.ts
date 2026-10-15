/**
 * Client-side slow-down after failed planner sign-ins.
 *
 * This is a courtesy layer for the person at the keyboard. The real brute-force protection is
 * Supabase Auth's server-side rate limit, which cannot be bypassed from the browser.
 *
 * The first few attempts are free; after that each failure doubles a lockout, capped at 5 min.
 */

export type ThrottleState = {
  failures: number
  /** Epoch ms until which sign-in is paused, or null. */
  lockedUntil: number | null
}

export const FREE_ATTEMPTS = 3
const BASE_LOCK_MS = 5_000
const MAX_LOCK_MS = 5 * 60_000

export const initialThrottle: ThrottleState = { failures: 0, lockedUntil: null }

export function lockDurationMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (failures - FREE_ATTEMPTS))
}

export function recordFailure(state: ThrottleState, now: number): ThrottleState {
  const failures = state.failures + 1
  const lock = lockDurationMs(failures)
  return { failures, lockedUntil: lock > 0 ? now + lock : null }
}

export function recordSuccess(): ThrottleState {
  return initialThrottle
}

/** Milliseconds left before another attempt is allowed; 0 when allowed now. */
export function remainingLockMs(state: ThrottleState, now: number): number {
  return state.lockedUntil === null ? 0 : Math.max(0, state.lockedUntil - now)
}

const STORAGE_KEY = 'wedonomics.loginThrottle'

/** Best-effort persistence so a reload doesn't reset the slow-down. */
export function loadThrottle(storage: Pick<Storage, 'getItem'> | undefined): ThrottleState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return initialThrottle
    const parsed = JSON.parse(raw) as Partial<ThrottleState>
    const failures = Number.isInteger(parsed.failures) ? Math.max(0, parsed.failures!) : 0
    const lockedUntil = typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null
    return { failures, lockedUntil }
  } catch {
    return initialThrottle
  }
}

export function saveThrottle(storage: Pick<Storage, 'setItem'> | undefined, state: ThrottleState) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode); the server-side limit still applies.
  }
}
