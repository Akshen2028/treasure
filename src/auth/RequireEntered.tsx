import { Navigate, Outlet, useLocation } from 'react-router'

import { paths } from '@/app/paths'
import { useWeddingRoute } from '@/app/WeddingContext'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { AiChatButton } from '@/features/chat/AiChatButton'
import { ChatProvider } from '@/features/chat/ChatProvider'

import { useAccess } from './AccessContext'

/**
 * Layout route: sends first-time visitors to the welcome screen, which brings them back here
 * (`?next=`, so a shared link still opens its wedding).
 */
export function RequireEntered() {
  const { status, mode, isPlanner } = useAccess()
  const { slug } = useWeddingRoute()
  const { pathname, search } = useLocation()
  if (status === 'initializing') return <SplashScreen />
  if (mode === 'unset') {
    const next = new URLSearchParams({ next: pathname + search })
    return <Navigate to={`${paths.welcome}?${next}`} replace />
  }
  return (
    // Locking, signing out or switching weddings discards the conversation.
    <ChatProvider key={`${slug}:${isPlanner ? 'planner' : 'guest'}`}>
      <Outlet />
      <AiChatButton />
    </ChatProvider>
  )
}
