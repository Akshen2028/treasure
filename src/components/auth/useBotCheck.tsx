import { LoaderCircle } from 'lucide-react'
import { type ReactNode, useCallback, useState } from 'react'

import { env } from '@/lib/env'

import { type CheckState, TurnstileWidget } from './TurnstileWidget'

export type BotCheck = {
  /** Pass to Supabase as `captchaToken`; undefined when the check isn't configured. */
  token: string | undefined
  /** True once the form may be submitted. */
  ready: boolean
  /** Tokens are single-use: call after every request that sent one. */
  reset: () => void
  /** The widget and its status line, to render inside the form. */
  element: ReactNode
}

/**
 * The bot check Supabase Auth requires before emailing a sign-in code once its captcha
 * protection is on. Without a site key configured, forms work without it.
 */
export function useBotCheck(): BotCheck {
  const siteKey = env.turnstileSiteKey
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<CheckState>('checking')
  // Changing the key remounts the widget, which runs a fresh check.
  const [round, setRound] = useState(0)

  const reset = useCallback(() => {
    setToken(null)
    setState('checking')
    setRound((r) => r + 1)
  }, [])

  if (!siteKey) return { token: undefined, ready: true, reset, element: null }

  return {
    token: token ?? undefined,
    ready: token !== null,
    reset,
    element: (
      <div className="flex flex-col gap-2">
        <TurnstileWidget key={round} siteKey={siteKey} onToken={setToken} onState={setState} />
        {state !== 'passed' && (
          <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
            {state === 'checking' ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Running a quick security check…
              </>
            ) : (
              'The security check couldn’t load. Check your connection, then reload the page.'
            )}
          </p>
        )}
      </div>
    ),
  }
}
