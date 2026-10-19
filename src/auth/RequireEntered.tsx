import { Navigate, Outlet } from 'react-router'

import { paths } from '@/app/paths'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { AiChatButton } from '@/features/chat/AiChatButton'
import { ChatProvider } from '@/features/chat/ChatProvider'

import { useAccess } from './AccessContext'

/** Layout route: sends first-time visitors to the welcome screen. */
export function RequireEntered() {
  const { status, mode, isPlanner } = useAccess()
  if (status === 'initializing') return <SplashScreen />
  if (mode === 'unset') return <Navigate to={paths.welcome} replace />
  return (
    // Locking or signing out discards the conversation.
    <ChatProvider key={isPlanner ? 'planner' : 'guest'}>
      <Outlet />
      <AiChatButton />
    </ChatProvider>
  )
}
