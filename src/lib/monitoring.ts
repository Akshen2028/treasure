import type * as SentryModule from '@sentry/react'

import { env } from './env'
import { scrubBreadcrumb, scrubEvent } from './scrub'

/**
 * Error reporting (Sentry), production only and only when VITE_SENTRY_DSN is set. Errors only:
 * no tracing, no session replay, no personal data, and URLs lose their query and fragment.
 * The SDK is a separate chunk loaded alongside the app, so it stays out of the entry bundle.
 */
let sentry: Promise<typeof SentryModule> | null = null

export function initMonitoring(): void {
  if (!env.sentryDsn || !import.meta.env.PROD || sentry) return
  const dsn = env.sentryDsn
  sentry = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Every category defaults to on; collect none of it.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        mcp: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
      },
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    })
    return Sentry
  })
}

/** Reports an error that was caught and shown to the user (e.g. the route error screen). */
export function reportError(error: unknown): void {
  void sentry?.then((Sentry) => Sentry.captureException(error))
}
