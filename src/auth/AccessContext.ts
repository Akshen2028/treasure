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
  signInAsPlanner: (password: string) => Promise<SignInResult>
  /** Redirects to Google; on success the page unloads and the result arrives after return. */
  signInWithGoogle: () => Promise<SignInResult>
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
