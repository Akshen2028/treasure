import type { AuthError } from '@supabase/supabase-js'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

import {
  AccessContext,
  type AccessContextValue,
  type AccessMode,
  type CreateWeddingResult,
  type DeleteAccountResult,
  type SignInResult,
} from './AccessContext'
import { deleteAccountFailureMessage } from './accountDeletion'
import { classifyOAuthError, parseOAuthCallback, stripOAuthParams } from './oauthCallback'
import { verifyPlanner } from './plannerVerification'
import {
  classifyEmailCodeError,
  classifySignInError,
  isUnknownAccountError,
  signInFailureMessage,
} from './signInErrors'
import { classifyCreateWeddingError } from './weddingCreation'

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

/**
 * Set just before redirecting to Google, so only a return from our own sign-in is treated
 * as an OAuth callback (not any URL that happens to carry `?code=`).
 */
const OAUTH_PENDING_KEY = 'wedonomics.oauth-pending'

function setOAuthPending(pending: boolean): boolean {
  try {
    if (pending) window.sessionStorage.setItem(OAUTH_PENDING_KEY, '1')
    else window.sessionStorage.removeItem(OAUTH_PENDING_KEY)
    return true
  } catch {
    return false
  }
}

function isOAuthPending(): boolean {
  try {
    return window.sessionStorage.getItem(OAUTH_PENDING_KEY) === '1'
  } catch {
    return false
  }
}

type RedirectOutcome = 'none' | 'signed-in' | 'failed'

let redirectOutcome: Promise<RedirectOutcome> | undefined

/**
 * Completes a Google sign-in when the page loads on its return. Runs once per page load
 * (StrictMode mounts effects twice; a code can be exchanged only once).
 */
function completeOAuthRedirect(): Promise<RedirectOutcome> {
  redirectOutcome ??= (async () => {
    if (!isOAuthPending()) return 'none'
    setOAuthPending(false)
    const callback = parseOAuthCallback(window.location.href)
    if (!callback) return 'none'
    window.history.replaceState(window.history.state, '', stripOAuthParams(window.location.href))

    if (callback.kind === 'error') {
      const failure = classifyOAuthError(callback)
      if (failure) toast.error(signInFailureMessage(failure))
      return 'failed'
    }
    const { error } = await supabase.auth.exchangeCodeForSession(callback.code)
    if (error) {
      toast.error(signInFailureMessage(classifySignInError(error)))
      return 'failed'
    }
    return 'signed-in'
  })()
  return redirectOutcome
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'initializing' | 'ready'>('initializing')
  const [mode, setMode] = useState<AccessMode>('unset')
  // The wedding the signed-in planner plans; null when not signed in as a planner.
  const [plannerSlug, setPlannerSlug] = useState<string | null>(null)
  // A session exists but couldn't be verified (e.g. offline); retry when possible.
  const pendingVerification = useRef(false)
  // When this tab last completed a sign-in (see AccessContextValue.signedInAt).
  const [signedInAt, setSignedInAt] = useState<number | null>(null)
  // Set while this tab signs in, so the SIGNED_IN event doesn't verify a second time.
  const signingIn = useRef(false)

  const fallbackMode = useCallback((): AccessMode => (hasEntered() ? 'guest' : 'unset'), [])

  /** Checks the current session with the server and sets the mode accordingly. */
  const applyVerification = useCallback(async () => {
    const result = await verifyPlanner()
    if (result.kind === 'planner') {
      pendingVerification.current = false
      markEntered()
      setPlannerSlug(result.slug)
      setMode('planner')
    } else if (result.kind === 'no-wedding') {
      // A new account: keep the session so it can create its wedding.
      pendingVerification.current = false
      markEntered()
      setPlannerSlug(null)
      setMode('new-account')
    } else if (result.kind === 'invalid-session') {
      pendingVerification.current = false
      await supabase.auth.signOut({ scope: 'local' })
      setPlannerSlug(null)
      setMode(fallbackMode())
    } else {
      // Unreachable: stay read-only for now, keep the session, and try again later.
      pendingVerification.current = true
      setMode(fallbackMode() === 'unset' ? 'guest' : fallbackMode())
    }
    return result.kind
  }, [fallbackMode])

  // Restore a saved session on load, first completing a Google sign-in if we just returned.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      signingIn.current = true
      try {
        const redirect = await completeOAuthRedirect()
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (data.session) {
          const result = await applyVerification()
          if (redirect === 'signed-in' && result === 'invalid-session') {
            toast.error(signInFailureMessage({ reason: 'not-planner' }))
          } else if (
            redirect === 'signed-in' &&
            (result === 'planner' || result === 'no-wedding')
          ) {
            setSignedInAt(Date.now())
          }
        } else setMode(fallbackMode())
        if (!cancelled) setStatus('ready')
      } finally {
        // A cancelled StrictMode run must not clear the flag while the second run works.
        if (!cancelled) signingIn.current = false
      }
    })()
    return () => {
      cancelled = true
    }
    // Both are used in the async body; the dependencies rule misreads it.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [applyVerification, fallbackMode])

  // React to sign-in or sign-out in another tab, and to a refresh token being revoked.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Supabase advises against awaiting its own calls inside this callback.
      if (event === 'SIGNED_OUT') {
        setTimeout(() => {
          setPlannerSlug(null)
          setMode(fallbackMode())
        }, 0)
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

  /**
   * Runs a sign-in request, then asks the server which wedding the account plans. An account
   * with none yet succeeds too, as a new account.
   */
  const signInAndVerify = useCallback(
    async (request: () => Promise<{ error: AuthError | null }>): Promise<SignInResult> => {
      signingIn.current = true
      try {
        const { error } = await request()
        if (error) return { ok: false, ...classifySignInError(error) }
        const verification = await applyVerification()
        if (verification === 'planner' || verification === 'no-wedding') {
          setSignedInAt(Date.now())
          return { ok: true }
        }
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

  const sendEmailCode = useCallback(
    async (email: string, captchaToken?: string): Promise<SignInResult> => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        // Accounts are created only through sign-up (closed for now), never by asking for a code.
        options: { shouldCreateUser: false, captchaToken },
      })
      // An unknown address looks the same as a sent code, so the form can't reveal accounts.
      if (!error || isUnknownAccountError(error)) return { ok: true }
      return { ok: false, ...classifyEmailCodeError(error) }
    },
    [],
  )

  const verifyEmailCode = useCallback(
    (email: string, code: string): Promise<SignInResult> =>
      signInAndVerify(() => supabase.auth.verifyOtp({ email, token: code, type: 'email' })),
    [signInAndVerify],
  )

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    // Without session storage the return can't be recognised (and PKCE can't store its
    // verifier either), so don't send the user on a round trip that can't finish.
    if (!setOAuthPending(true)) return { ok: false, reason: 'unknown', detail: 'No storage' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Come back to the same screen; the allowlist in Supabase Auth must cover it.
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setOAuthPending(false)
      return { ok: false, ...classifySignInError(error) }
    }
    return { ok: true }
  }, [])

  const endSession = useCallback(
    async (scope: 'local' | 'global') => {
      pendingVerification.current = false
      // Local sign-out clears this device even if the server can't be reached.
      const { error } = await supabase.auth.signOut({ scope })
      if (error && scope === 'global') {
        await supabase.auth.signOut({ scope: 'local' })
      }
      setPlannerSlug(null)
      setMode(fallbackMode() === 'unset' ? 'guest' : fallbackMode())
    },
    [fallbackMode],
  )

  const createWedding = useCallback(
    async (name: string, weddingDate: string | null): Promise<CreateWeddingResult> => {
      const { data, error } = await supabase.rpc('create_my_wedding', {
        p_name: name,
        p_wedding_date: weddingDate ?? undefined,
      })
      if (error) {
        const failure = classifyCreateWeddingError(error)
        // Created in another tab meanwhile: carry on with that wedding.
        if (failure.reason === 'already-planning' && (await applyVerification()) === 'planner') {
          return { ok: true }
        }
        if (failure.reason === 'signed-out') await endSession('local')
        return { ok: false, ...failure }
      }
      // The database just made this account the wedding's planner; no need to ask again.
      pendingVerification.current = false
      setPlannerSlug(data.slug)
      setMode('planner')
      return { ok: true }
    },
    // Both are used in the async body; the memo-dependencies rule misreads it.
    // oxlint-disable-next-line react/memo-dependencies
    [applyVerification, endSession],
  )

  const deleteAccount = useCallback(
    async (slug: string): Promise<DeleteAccountResult> => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return { ok: false, message: deleteAccountFailureMessage(401, null) }
      let response: Response
      try {
        response = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            apikey: env.supabasePublishableKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ slug }),
        })
      } catch {
        return { ok: false, message: deleteAccountFailureMessage(null, null) }
      }
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        return { ok: false, message: deleteAccountFailureMessage(response.status, body) }
      }
      // The account is gone and its sessions revoked; clear this device too.
      await endSession('local')
      return { ok: true }
    },
    [endSession],
  )

  const value = useMemo<AccessContextValue>(
    () => ({
      status,
      mode,
      plannerSlug: mode === 'planner' ? plannerSlug : null,
      signedInAt,
      continueAsGuest,
      signInWithGoogle,
      sendEmailCode,
      verifyEmailCode,
      createWedding,
      // setPlannerSlug is stable; the updater keeps the slug unset outside planner mode.
      plannerSlugChanged: (slug: string) => setPlannerSlug((current) => current && slug),
      lock: () => endSession('local'),
      signOutEverywhere: () => endSession('global'),
      deleteAccount,
    }),
    [
      status,
      mode,
      plannerSlug,
      signedInAt,
      continueAsGuest,
      signInWithGoogle,
      sendEmailCode,
      verifyEmailCode,
      createWedding,
      endSession,
      deleteAccount,
    ],
  )

  return <AccessContext value={value}>{children}</AccessContext>
}
