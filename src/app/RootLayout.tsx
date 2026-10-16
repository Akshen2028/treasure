import { Outlet, ScrollRestoration } from 'react-router'

import { Toaster } from '@/components/ui/sonner'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
      <Toaster />
    </>
  )
}
