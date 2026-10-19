import { createContext, useContext } from 'react'

import type { WeddingData } from '@/data/queries'

import type { useChat } from './useChat'

export type ChatSession = ReturnType<typeof useChat> & { data: WeddingData | undefined }

export const ChatContext = createContext<ChatSession | null>(null)

/** The current conversation, which outlives the chat page until a refresh or "New chat". */
export function useChatSession(): ChatSession {
  const session = useContext(ChatContext)
  if (!session) throw new Error('useChatSession must be used inside ChatProvider')
  return session
}
