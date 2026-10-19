import { type ReactNode, useMemo } from 'react'

import { useWeddingData } from '@/data/queries'

import { ChatContext } from './ChatContext'
import { useChat } from './useChat'

/** Holds the conversation above the routes, so leaving the chat page doesn't lose it. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { data } = useWeddingData()
  const chat = useChat(data)
  const session = useMemo(() => ({ ...chat, data }), [chat, data])
  return <ChatContext value={session}>{children}</ChatContext>
}
