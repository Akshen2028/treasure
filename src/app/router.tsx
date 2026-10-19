import { createBrowserRouter } from 'react-router'

import { RequireEntered } from '@/auth/RequireEntered'
import { RouteError } from '@/components/feedback/RouteError'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { WelcomePage } from '@/pages/WelcomePage'

import { trackPageTransitions } from './pageTransitions'
import { RootLayout } from './RootLayout'

/*
 * Every screen except Welcome loads on demand, so the first visit only downloads what it
 * needs (for example, the charts library is fetched with the dashboard, not up front).
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <SplashScreen />,
    children: [
      { path: '/', element: <WelcomePage /> },
      {
        // Everything past the welcome screen requires choosing guest or planner first.
        element: <RequireEntered />,
        children: [
          {
            path: '/home',
            lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }),
          },
          {
            path: '/search',
            lazy: async () => ({ Component: (await import('@/pages/SearchPage')).SearchPage }),
          },
          {
            path: '/settings',
            lazy: async () => ({ Component: (await import('@/pages/SettingsPage')).SettingsPage }),
          },
          {
            path: '/settings/deleted',
            lazy: async () => ({
              Component: (await import('@/pages/RecentlyDeletedPage')).RecentlyDeletedPage,
            }),
          },
          {
            path: '/settings/export',
            lazy: async () => ({ Component: (await import('@/pages/AiExportPage')).AiExportPage }),
          },
          {
            path: '/chat',
            lazy: async () => ({ Component: (await import('@/pages/ChatPage')).ChatPage }),
          },
          {
            path: '/events/:eventId',
            lazy: async () => ({ Component: (await import('@/pages/EventPage')).EventPage }),
          },
          {
            path: '/events/:eventId/categories/:categoryId',
            lazy: async () => ({ Component: (await import('@/pages/CategoryPage')).CategoryPage }),
          },
          {
            path: '/events/:eventId/categories/:categoryId/activities/:activityId',
            lazy: async () => ({ Component: (await import('@/pages/ActivityPage')).ActivityPage }),
          },
          {
            path: '/events/:eventId/categories/:categoryId/activities/:activityId/payments',
            lazy: async () => ({ Component: (await import('@/pages/PaymentsPage')).PaymentsPage }),
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
])

trackPageTransitions(router)
