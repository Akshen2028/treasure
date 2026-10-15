import { describe, expect, it } from 'vitest'

import {
  FREE_ATTEMPTS,
  initialThrottle,
  loadThrottle,
  lockDurationMs,
  recordFailure,
  recordSuccess,
  remainingLockMs,
  saveThrottle,
} from './loginThrottle'

const fail = (times: number, now = 0) => {
  let state = initialThrottle
  for (let i = 0; i < times; i++) state = recordFailure(state, now)
  return state
}

describe('login throttle', () => {
  it('allows the first attempts without delay', () => {
    const state = fail(FREE_ATTEMPTS - 1)
    expect(state.lockedUntil).toBeNull()
    expect(remainingLockMs(state, 0)).toBe(0)
  })

  it('locks after the free attempts and doubles each time, capped at 5 minutes', () => {
    expect(lockDurationMs(FREE_ATTEMPTS)).toBe(5_000)
    expect(lockDurationMs(FREE_ATTEMPTS + 1)).toBe(10_000)
    expect(lockDurationMs(FREE_ATTEMPTS + 2)).toBe(20_000)
    expect(lockDurationMs(FREE_ATTEMPTS + 20)).toBe(300_000)
  })

  it('reports the remaining lock and releases it when the time passes', () => {
    const state = fail(FREE_ATTEMPTS, 1_000)
    expect(remainingLockMs(state, 1_000)).toBe(5_000)
    expect(remainingLockMs(state, 4_000)).toBe(2_000)
    expect(remainingLockMs(state, 6_000)).toBe(0)
  })

  it('resets after a successful sign-in', () => {
    expect(recordSuccess()).toEqual(initialThrottle)
  })

  it('round-trips through storage and ignores corrupt data', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    const state = fail(FREE_ATTEMPTS + 1, 10)
    saveThrottle(storage, state)
    expect(loadThrottle(storage)).toEqual(state)

    store.set('wedonomics.loginThrottle', '{not json')
    expect(loadThrottle(storage)).toEqual(initialThrottle)
    expect(loadThrottle(undefined)).toEqual(initialThrottle)
  })
})
