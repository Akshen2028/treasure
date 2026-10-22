import { createContext, use } from 'react'

import type { SignInFailure } from './signInErrors'

/**
 * - unset: first visit, nothing chosen yet (show the welcome screen)
 * - guest: read-only
 * - planner: signed in and confirmed by the server as a planner of this wedding
 */
export type AccessMode = 'unset' | 'guest' | 'planner'

export type SignInResult = { ok: true } | ({ ok: false } & SignInFailure)

export type AccessContextValue = {
  /** 'initializing' while a saved session is being restored and verified. */
  status: 'initializing' | 'ready'
  mode: AccessMode
  isPlanner: boolean
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
  /** Ends the planner session on this device only. */
  lock: () => Promise<void>
  /** Ends the planner session on every device. */
  signOutEverywhere: () => Promise<void>
}

export const AccessContext = createContext<AccessContextValue | null>(null)

export function useAccess(): AccessContextValue {
  const value = use(AccessContext)
  if (!value) throw new Error('useAccess must be used inside <AccessProvider>')
  return value
}
