import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'

import type { WeddingData } from '@/data/queries'
import { type ChatMessage } from '@/domain/chat'
import { type ChartSpec, chartNote, type EditStatus, editNote } from '@/domain/chatTools'
import { todayIso } from '@/domain/dates'
import { buildWeddingExport, exportToMarkdown } from '@/domain/export'
import { useMediaUrl } from '@/data/queries'

import { aiUsageKey } from './aiUsage'
import type { ApplyResult, EditFocus } from './applyChatEdit'
import { ChatError, streamChat } from './chatApi'
import { type ResolvedEdit, resolveEdit } from './chatEdits'
import { buildChatRefs, type RefTarget } from './chatRefs'

export type ChatStatus = 'idle' | 'streaming'

export type ChatAttachment =
  | { type: 'chart'; spec: ChartSpec; targets: Map<string, RefTarget> }
  | {
      type: 'edit'
      edit: ResolvedEdit
      status: EditStatus
      /** After applying: how to reverse it, and why it stopped early if it did. */
      undo?: ApplyResult['undo']
      error?: string
      /** After applying: the page that shows the change. */
      focus?: EditFocus
    }

/** A message plus any charts or proposals the assistant attached to it. */
export type ChatTurn = ChatMessage & { attachments: ChatAttachment[] }

/** What Claude reads back: the text, plus a note for each chart or proposal. */
export function toApiMessages(turns: ChatTurn[]): ChatMessage[] {
  return turns.map(({ role, content, attachments }) => ({
    role,
    content: [
      content.trim(),
      ...attachments.map((a) =>
        a.type === 'chart' ? chartNote(a.spec) : editNote(a.edit.summary, a.status),
      ),
    ]
      .filter(Boolean)
      .join('\n\n'),
  }))
}

const isEmptyAnswer = (turn: ChatTurn | undefined) =>
  turn?.role === 'assistant' && !turn.content.trim() && turn.attachments.length === 0

/**
 * One conversation with the assistant, kept in memory only (a refresh or "New chat" clears
 * it). Each question sends the latest wedding export, so answers reflect current data.
 */
export function useChat(data: WeddingData | undefined) {
  const mediaUrl = useMediaUrl()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  /** The last failure, with the question to offer for a retry. */
  const [error, setError] = useState<{ message: string; question: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (question: string) => {
      const content = question.trim()
      if (!content || !data || abortRef.current) return

      const asked: ChatTurn[] = [...messages, { role: 'user', content, attachments: [] }]
      setMessages([...asked, { role: 'assistant', content: '', attachments: [] }])
      setError(null)
      setStatus('streaming')

      const controller = new AbortController()
      abortRef.current = controller
      const exported = buildWeddingExport(data.snapshot, {
        mediaUrl,
        generatedAt: new Date().toISOString(),
      })
      const { refs, targets } = buildChatRefs(data.active)
      const updateAnswer = (update: (turn: ChatTurn) => ChatTurn) =>
        setMessages((current) => {
          const last = current.at(-1)
          if (!last || last.role !== 'assistant') return current
          return [...current.slice(0, -1), update(last)]
        })
      const attach = (attachment: ChatAttachment) =>
        updateAnswer((turn) => ({ ...turn, attachments: [...turn.attachments, attachment] }))

      try {
        await streamChat(
          {
            weddingId: data.snapshot.wedding.id,
            exportText: exportToMarkdown(exported),
            messages: toApiMessages(asked),
            refs,
            today: todayIso(),
          },
          {
            signal: controller.signal,
            onText: (text) => updateAnswer((turn) => ({ ...turn, content: turn.content + text })),
            onChart: (spec) => attach({ type: 'chart', spec, targets }),
            onEdit: (proposal) => {
              const edit = resolveEdit(proposal, data.active, targets)
              attach({ type: 'edit', edit, status: edit.problems.length ? 'invalid' : 'pending' })
            },
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
        setMessages((current) => (isEmptyAnswer(current.at(-1)) ? current.slice(0, -2) : current))
        abortRef.current = null
        setStatus('idle')
        // Every question that reached the server may have been counted.
        void queryClient.invalidateQueries({ queryKey: aiUsageKey(data.snapshot.wedding.id) })
      }
    },
    // queryClient is used in the async body; the memo-dependencies rule misreads it.
    // oxlint-disable-next-line react/memo-dependencies
    [data, mediaUrl, messages, queryClient],
  )

  /** Records what happened to a proposal (applied, dismissed, undone…). */
  const updateEdit = useCallback(
    (
      messageIndex: number,
      attachmentIndex: number,
      patch: Partial<Extract<ChatAttachment, { type: 'edit' }>>,
    ) =>
      setMessages((current) =>
        current.map((turn, i) =>
          i !== messageIndex
            ? turn
            : {
                ...turn,
                attachments: turn.attachments.map((a, j) =>
                  j === attachmentIndex && a.type === 'edit' ? { ...a, ...patch } : a,
                ),
              },
        ),
      ),
    [],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }, [])

  return useMemo(
    () => ({ messages, status, error, send, stop, reset, updateEdit }),
    [messages, status, error, send, stop, reset, updateEdit],
  )
}
