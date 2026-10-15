import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

import {
  AccessContext,
  type AccessContextValue,
  type AccessMode,
  type SignInResult,
} from './AccessContext'
import {
  loadThrottle,
  recordFailure,
  recordSuccess,
  remainingLockMs,
  saveThrottle,
} from './loginThrottle'
import { verifyPlanner } from './plannerVerification'
import { classifySignInError } from './signInErrors'

/**
 * Remembers that this browser has been past the welcome screen. It is a UI preference,
 * not a credential: planner rights come only from a verified Supabase session.
 */
const ENTERED_KEY = 'wedonomics.entered'

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function hasEntered(): boolean {
  try {
    return safeStorage()?.getItem(ENTERED_KEY) === '1'
  } catch {
    return false
  }
}

function markEntered() {
  try {
    safeStorage()?.setItem(ENTERED_KEY, '1')
  } catch {
    // Without storage the welcome screen simply shows again next visit.
  }
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'initializing' | 'ready'>('initializing')
  const [mode, setMode] = useState<AccessMode>('unset')
  // A session exists but couldn't be verified (e.g. offline); retry when possible.
  const pendingVerification = useRef(false)
  // Set while this tab signs in, so the SIGNED_IN event doesn't verify a second time.
  const signingIn = useRef(false)

  const fallbackMode = useCallback((): AccessMode => (hasEntered() ? 'guest' : 'unset'), [])

  /** Checks the current session with the server and sets the mode accordingly. */
  const applyVerification = useCallback(async () => {
    const result = await verifyPlanner()
    if (result === 'planner') {
      pendingVerification.current = false
      markEntered()
      setMode('planner')
    } else if (result === 'not-planner') {
      pendingVerification.current = false
      await supabase.auth.signOut({ scope: 'local' })
      setMode(fallbackMode())
    } else {
      // Unreachable: stay read-only for now, keep the session, and try again later.
      pendingVerification.current = true
      setMode(fallbackMode() === 'unset' ? 'guest' : fallbackMode())
    }
    return result
  }, [fallbackMode])

  // Restore a saved session on load.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) await applyVerification()
      else setMode(fallbackMode())
      if (!cancelled) setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [applyVerification, fallbackMode])

  // React to sign-in or sign-out in another tab, and to a refresh token being revoked.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Supabase advises against awaiting its own calls inside this callback.
      if (event === 'SIGNED_OUT') {
        setTimeout(() => setMode(fallbackMode()), 0)
      } else if (event === 'SIGNED_IN' && !signingIn.current) {
        setTimeout(() => void applyVerification(), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [applyVerification, fallbackMode])

  // Retry a verification that failed for connectivity reasons.
  useEffect(() => {
    const retry = () => {
      if (pendingVerification.current && document.visibilityState === 'visible') {
        void applyVerification()
      }
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [applyVerification])

  const continueAsGuest = useCallback(() => {
    markEntered()
    setMode('guest')
  }, [])

  const signInAsPlanner = useCallback(
    async (password: string): Promise<SignInResult> => {
      const email = env.plannerEmail
      if (!email) return { ok: false, reason: 'not-configured' }

      const storage = safeStorage()
      const throttle = loadThrottle(storage)
      const wait = remainingLockMs(throttle, Date.now())
      if (wait > 0) return { ok: false, reason: 'throttled', retryInMs: wait }

      signingIn.current = true
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const failure = classifySignInError(error)
          if (failure.reason === 'wrong-password') {
            saveThrottle(storage, recordFailure(throttle, Date.now()))
          }
          return { ok: false, ...failure }
        }

        saveThrottle(storage, recordSuccess())
        const verification = await applyVerification()
        if (verification === 'planner') return { ok: true }
        if (verification === 'unreachable') return { ok: false, reason: 'network' }
        return { ok: false, reason: 'not-planner' }
      } finally {
        signingIn.current = false
      }
    },
    // applyVerification is used above; the memo-dependencies rule misreads the async body.
    // oxlint-disable-next-line react/memo-dependencies
    [applyVerification],
  )

  const endSession = useCallback(
    async (scope: 'local' | 'global') => {
      pendingVerification.current = false
      // Local sign-out clears this device even if the server can't be reached.
      const { error } = await supabase.auth.signOut({ scope })
      if (error && scope === 'global') {
        await supabase.auth.signOut({ scope: 'local' })
      }
      setMode(fallbackMode() === 'unset' ? 'guest' : fallbackMode())
    },
    [fallbackMode],
  )

  const value = useMemo<AccessContextValue>(
    () => ({
      status,
      mode,
      isPlanner: mode === 'planner',
      continueAsGuest,
      signInAsPlanner,
      lock: () => endSession('local'),
      signOutEverywhere: () => endSession('global'),
    }),
    [status, mode, continueAsGuest, signInAsPlanner, endSession],
  )

  return <AccessContext value={value}>{children}</AccessContext>
}
