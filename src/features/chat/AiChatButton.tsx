import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { Button } from '@/components/ui/button'

/** Floating button on every screen that opens the assistant. Planners only. */
export function AiChatButton() {
  const { isPlanner } = useAccess()
  const { pathname } = useLocation()

  // Fetch the chat screen ahead of time, so the first tap opens it straight away.
  useEffect(() => {
    if (isPlanner) void import('@/pages/ChatPage')
  }, [isPlanner])

  if (!isPlanner || pathname === paths.chat) return null

  return (
    <Button
      asChild
      size="icon"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 size-14 rounded-full shadow-lifted"
    >
      {/* Remember where we came from, so the chat's back button returns there. */}
      <Link to={paths.chat} state={{ from: pathname }} title="Ask about the wedding">
        <Sparkles className="size-6" aria-hidden="true" />
        <span className="sr-only">Ask about the wedding (AI assistant)</span>
      </Link>
    </Button>
  )
}
