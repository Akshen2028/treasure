import { createBrowserRouter } from 'react-router'

import { RequireEntered } from '@/auth/RequireEntered'
import { RouteError } from '@/components/feedback/RouteError'
import { ActivityPage } from '@/pages/ActivityPage'
import { AiExportPage } from '@/pages/AiExportPage'
import { CategoryPage } from '@/pages/CategoryPage'
import { EventPage } from '@/pages/EventPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { RecentlyDeletedPage } from '@/pages/RecentlyDeletedPage'
import { SearchPage } from '@/pages/SearchPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { WelcomePage } from '@/pages/WelcomePage'

import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <WelcomePage /> },
      {
        // Everything past the welcome screen requires choosing guest or planner first.
        element: <RequireEntered />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/deleted', element: <RecentlyDeletedPage /> },
          { path: '/settings/export', element: <AiExportPage /> },
          { path: '/events/:eventId', element: <EventPage /> },
          { path: '/events/:eventId/categories/:categoryId', element: <CategoryPage /> },
          {
            path: '/events/:eventId/categories/:categoryId/activities/:activityId',
            element: <ActivityPage />,
          },
          {
            path: '/events/:eventId/categories/:categoryId/activities/:activityId/payments',
            element: <PaymentsPage />,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
