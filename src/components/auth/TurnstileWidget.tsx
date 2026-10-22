import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile, the bot check Supabase Auth requires on password and email-code
 * sign-ins once its captcha protection is on. Usually invisible; it shows a checkbox only when
 * Cloudflare is unsure. The script loads on first use, so guests never download it.
 */
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'))
    script.onerror = () => {
      // Allow a later attempt (e.g. after reconnecting) to try again.
      loading = null
      script.remove()
      reject(new Error('Turnstile failed to load'))
    }
    document.head.append(script)
  })
  return loading
}

export type CheckState = 'checking' | 'passed' | 'failed'

export function TurnstileWidget({
  siteKey,
  onToken,
  onState,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  onState: (state: CheckState) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'sign-in',
          theme: 'auto',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: (token: string) => {
            onToken(token)
            onState('passed')
          },
          'expired-callback': () => {
            onToken(null)
            onState('checking')
          },
          'error-callback': () => {
            onToken(null)
            onState('failed')
          },
        })
      },
      () => {
        if (!cancelled) onState('failed')
      },
    )
    return () => {
      cancelled = true
      if (widgetId !== null) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, onToken, onState])

  return <div ref={containerRef} className="empty:hidden" />
}
