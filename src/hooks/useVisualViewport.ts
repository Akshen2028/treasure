import { useMemo, useSyncExternalStore } from 'react'

export type VisibleArea = { top: number; height: number }

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport
  viewport?.addEventListener('resize', onChange)
  viewport?.addEventListener('scroll', onChange)
  return () => {
    viewport?.removeEventListener('resize', onChange)
    viewport?.removeEventListener('scroll', onChange)
  }
}

const unsubscribed = () => () => {}

// A string snapshot, so React sees an unchanged value as equal.
function snapshot() {
  const viewport = window.visualViewport
  return viewport ? `${viewport.offsetTop}:${viewport.height}` : ''
}

const none = () => ''

/**
 * The part of the screen actually visible, which shrinks when the on-screen keyboard opens.
 * iOS Safari overlays the keyboard without resizing the page (so `dvh` doesn't change);
 * only `window.visualViewport` reports it. Null where unsupported or when not enabled.
 */
export function useVisualViewport(enabled: boolean): VisibleArea | null {
  const value = useSyncExternalStore(
    enabled ? subscribe : unsubscribed,
    enabled ? snapshot : none,
    none,
  )
  return useMemo(() => {
    if (!value) return null
    const [top = 0, height = 0] = value.split(':').map(Number)
    return { top, height }
  }, [value])
}
