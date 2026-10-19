import type { DataRouter } from 'react-router'

import { paths } from './paths'

/**
 * Page-to-page animation. Links and navigate() calls opt in with `viewTransition`, React Router
 * wraps the route change in the browser's View Transitions API, and `index.css` animates it
 * according to the direction set here on <html data-nav-direction>.
 */
export type NavDirection = 'forward' | 'back' | 'fade' | 'up' | 'down'

const depth = (pathname: string) => pathname.split('/').filter(Boolean).length

/**
 * Drilling into the hierarchy (event → category → activity) slides forward, going up slides
 * back, and hopping between top-level screens (dashboard, search, settings) cross-fades. The
 * assistant opens over any screen like a sheet, so it rises up and drops back down.
 */
export function navDirection(fromPathname: string, toPathname: string): NavDirection {
  if (toPathname === paths.chat) return 'up'
  if (fromPathname === paths.chat) return 'down'
  const from = depth(fromPathname)
  const to = depth(toPathname)
  if (to > from) return 'forward'
  if (to < from) return 'back'
  return 'fade'
}

let lastTransitionAt = -Infinity

/**
 * True while a view transition is animating the page in. Pages that mount during one skip their
 * own entrance animation, which only plays on first load, redirects and older browsers.
 */
export function isViewTransitionRecent(now = performance.now()) {
  return now - lastTransitionAt < 1000
}

/**
 * iOS Safari can drop the scroll-to-top that <ScrollRestoration> makes while a view transition is
 * running, leaving the new page part-scrolled. Repeat it once the new page is in, and when the
 * animation ends. Back navigations (POP) keep the position ScrollRestoration restored.
 */
function keepNewPageAtTop() {
  if (typeof document.startViewTransition !== 'function') return
  const start = document.startViewTransition.bind(document)
  document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
    const transition = start(update)
    if (pendingScrollReset) {
      pendingScrollReset = false
      const toTop = () => {
        if (window.scrollY !== 0 && !window.location.hash) window.scrollTo(0, 0)
      }
      void transition.updateCallbackDone.then(toTop, () => {})
      void transition.finished.then(toTop, () => {})
    }
    return transition
  }) as typeof document.startViewTransition
}

let pendingScrollReset = false

/** Sets the direction before React Router starts each view transition. Call once at startup. */
export function trackPageTransitions(router: DataRouter) {
  keepNewPageAtTop()
  let pathname = router.state.location.pathname
  return router.subscribe((state, { viewTransitionOpts }) => {
    const next = state.location.pathname
    if (viewTransitionOpts && next !== pathname) {
      document.documentElement.dataset.navDirection = navDirection(pathname, next)
      lastTransitionAt = performance.now()
      pendingScrollReset = state.historyAction !== 'POP'
    }
    pathname = next
  })
}
