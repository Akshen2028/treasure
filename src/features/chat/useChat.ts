import { useCallback, useMemo, useRef, useState } from 'react'

import type { WeddingData } from '@/data/queries'
import { type ChatMessage } from '@/domain/chat'
import { buildWeddingExport, exportToMarkdown } from '@/domain/export'
import { useMediaUrl } from '@/features/media/useMediaUrl'

import { ChatError, streamChat } from './chatApi'

export type ChatStatus = 'idle' | 'streaming'

/**
 * One conversation with the assistant, kept in memory only (a refresh or "New chat" clears
 * it). Each question sends the latest wedding export, so answers reflect current data.
 */
export function useChat(data: WeddingData | undefined) {
  const mediaUrl = useMediaUrl()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  /** The last failure, with the question to offer for a retry. */
  const [error, setError] = useState<{ message: string; question: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (question: string) => {
      const content = question.trim()
      if (!content || !data || abortRef.current) return

      const asked: ChatMessage[] = [...messages, { role: 'user', content }]
      setMessages([...asked, { role: 'assistant', content: '' }])
      setError(null)
      setStatus('streaming')

      const controller = new AbortController()
      abortRef.current = controller
      const exported = buildWeddingExport(data.snapshot, {
        mediaUrl,
        generatedAt: new Date().toISOString(),
      })
      try {
        await streamChat(
          {
            weddingId: data.snapshot.wedding.id,
            exportText: exportToMarkdown(exported),
            messages: asked,
          },
          {
            signal: controller.signal,
            onText: (text) =>
              setMessages((current) => {
                const last = current.at(-1)
                if (!last || last.role !== 'assistant') return current
                return [...current.slice(0, -1), { ...last, content: last.content + text }]
              }),
          },
        )
      } catch (caught) {
        if (!controller.signal.aborted) {
          const message =
            caught instanceof ChatError
              ? caught.message
              : 'Couldn’t reach the assistant. Try again.'
          setError({ message, question: content })
        }
      } finally {
        // Keep a partial answer; with no answer at all, take the question back out too, so
        // turns keep alternating and it can be asked again.
        setMessages((current) => {
          const last = current.at(-1)
          return last?.role === 'assistant' && !last.content.trim() ? current.slice(0, -2) : current
        })
        abortRef.current = null
        setStatus('idle')
      }
    },
    [data, mediaUrl, messages],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }, [])

  return useMemo(
    () => ({ messages, status, error, send, stop, reset }),
    [messages, status, error, send, stop, reset],
  )
}
