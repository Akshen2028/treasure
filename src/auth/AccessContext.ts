import { createContext, use, useMemo } from 'react'

import { useOptionalWeddingRoute } from '@/app/WeddingContext'

import { showsPlannerControls } from './plannerAccess'

import type { SignInFailure } from './signInErrors'
import type { CreateWeddingFailure } from './weddingCreation'

/**
 * - unset: first visit, nothing chosen yet (show the welcome screen)
 * - guest: read-only
 * - new-account: signed in, but the account plans no wedding yet (show "Create your wedding")
 * - planner: signed in and confirmed by the server as the planner of a wedding (`plannerSlug`)
 */
export type AccessMode = 'unset' | 'guest' | 'new-account' | 'planner'

export type SignInResult = { ok: true } | ({ ok: false } & SignInFailure)

export type CreateWeddingResult = { ok: true } | ({ ok: false } & CreateWeddingFailure)

export type AccessContextValue = {
  /** 'initializing' while a saved session is being restored and verified. */
  status: 'initializing' | 'ready'
  mode: AccessMode
  /** The wedding the signed-in planner plans (one per account); null otherwise. */
  plannerSlug: string | null
  continueAsGuest: () => void
  /** Redirects to Google; on success the page unloads and the result arrives after return. */
  signInWithGoogle: () => Promise<SignInResult>
  /**
   * Emails a sign-in code. Succeeds for unknown addresses too, without sending anything.
   * `captchaToken` comes from the bot check (`useBotCheck`) when it is configured.
   */
  sendEmailCode: (email: string, captchaToken?: string) => Promise<SignInResult>
  /** Signs in with the emailed code, then confirms planner access like the other methods. */
  verifyEmailCode: (email: string, code: string) => Promise<SignInResult>
  /**
   * Creates the signed-in account's one wedding (`create_my_wedding`). On success the mode
   * becomes planner of the new wedding.
   */
  createWedding: (name: string, weddingDate: string | null) => Promise<CreateWeddingResult>
  /** Ends the planner session on this device only. */
  lock: () => Promise<void>
  /** Ends the planner session on every device. */
  signOutEverywhere: () => Promise<void>
}

export const AccessContext = createContext<AccessContextValue | null>(null)

export type Access = AccessContextValue & {
  /** Whether to show planner controls here (see `showsPlannerControls`). */
  isPlanner: boolean
}

export function useAccess(): Access {
  const value = use(AccessContext)
  const weddingSlug = useOptionalWeddingRoute()?.slug ?? null
  const access = useMemo(
    () =>
      value && {
        ...value,
        isPlanner: showsPlannerControls(value.plannerSlug, weddingSlug),
      },
    [value, weddingSlug],
  )
  if (!access) throw new Error('useAccess must be used inside <AccessProvider>')
  return access
}
