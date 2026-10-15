import { Navigate, Outlet } from 'react-router'

import { paths } from '@/app/paths'
import { SplashScreen } from '@/components/feedback/SplashScreen'

import { useAccess } from './AccessContext'

/** Layout route: sends first-time visitors to the welcome screen. */
export function RequireEntered() {
  const { status, mode } = useAccess()
  if (status === 'initializing') return <SplashScreen />
  if (mode === 'unset') return <Navigate to={paths.welcome} replace />
  return <Outlet />
}
