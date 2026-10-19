import { ArrowUp, CircleAlert, LoaderCircle, RotateCcw, Square } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { isViewTransitionRecent } from '@/app/pageTransitions'
import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { PlannerOnly } from '@/components/auth/PlannerOnly'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CHAT_LIMITS, CHAT_SUGGESTIONS } from '@/domain/chat'
import { ChatChart } from '@/features/chat/ChatChart'
import { useChatSession } from '@/features/chat/ChatContext'
import { ChatEditCard } from '@/features/chat/ChatEditCard'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { cn } from '@/lib/utils'

/** Where the back button goes: the screen the chat was opened from, else Home. */
function useBackTarget() {
  const state: unknown = useLocation().state
  const from =
    typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined
  return typeof from === 'string' && from !== paths.chat ? from : paths.home
}

function Conversation() {
  const { messages, status, error, send, stop, reset, updateEdit, data } = useChatSession()
  const backTo = useBackTarget()
  // iOS overlays the keyboard without resizing the page; fit the screen to what's visible.
  const visible = useVisualViewport(true)
  const [draft, setDraft] = useState('')
  // Opening from a link already slides the screen up (see pageTransitions.ts).
  const [slideIn] = useState(() => !isViewTransitionRecent())
  const logRef = useRef<HTMLDivElement>(null)
  const streaming = status === 'streaming'
  // Room for one more question and its answer.
  const full = messages.length >= CHAT_LIMITS.messages - 1

  // Only the conversation scrolls: lock the page behind it, or iOS drags and bounces the
  // whole screen when a swipe reaches the end of the conversation.
  useLayoutEffect(() => {
    const targets = [document.documentElement, document.body]
    const previous = targets.map((el) => [el.style.overflow, el.style.overscrollBehavior])
    for (const el of targets) {
      el.style.overflow = 'hidden'
      el.style.overscrollBehavior = 'none'
    }
    return () =>
      targets.forEach((el, i) => {
        el.style.overflow = previous[i]?.[0] ?? ''
        el.style.overscrollBehavior = previous[i]?.[1] ?? ''
      })
  }, [])

  // The conversation is laid out bottom-up (flex-col-reverse), so the browser itself anchors
  // it to the latest message: on open, as answers stream in, and as the keyboard resizes the
  // screen. No scroll-jumping from JavaScript. In this layout scrollTop 0 is the bottom, and
  // the content's `mb-auto` keeps a short conversation at the top instead.
  function scrollToLatest() {
    logRef.current?.scrollTo({ top: 0 })
  }

  function ask(question: string) {
    if (!question.trim() || streaming || full) return
    setDraft('')
    scrollToLatest()
    void send(question)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    ask(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line. Ignore Enter while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      ask(draft)
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 flex h-dvh flex-col bg-background',
        slideIn &&
          'animate-in duration-300 ease-out fade-in slide-in-from-bottom-12 motion-reduce:animate-none',
      )}
      style={visible ? { top: visible.top, height: visible.height } : undefined}
    >
      <DetailHeader
        backTo={backTo}
        backLabel="Back"
        title="Assistant"
        actions={
          messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw data-icon="inline-start" />
              New chat
            </Button>
          )
        }
      />

      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        aria-busy={streaming}
        className="flex flex-1 flex-col-reverse overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto mb-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 sm:px-6">
          <div className="mb-2">
            <h1 className="text-4xl">Ask about the wedding</h1>
            <p className="mt-1 text-muted-foreground">
              Claude answers from your current budget, draws charts, and proposes changes you can
              review and apply. The conversation isn’t saved.
            </p>
          </div>

          {messages.length === 0 && !error && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Try one of these, or ask your own:</p>
              {CHAT_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  className="h-auto justify-start py-3 text-left whitespace-normal"
                  disabled={!data}
                  onClick={() => ask(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

          {messages.map((message, index) => {
            const answering = streaming && index === messages.length - 1
            // Leading line breaks (e.g. text that follows a chart) would show as blank space.
            const text = message.content.trimStart()
            const showBubble = text || (answering && message.attachments.length === 0)
            return (
              <div key={index} className="flex flex-col gap-3">
                {showBubble && (
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap',
                      message.role === 'user'
                        ? 'self-end rounded-br-md bg-primary text-primary-foreground'
                        : 'self-start rounded-bl-md bg-secondary text-secondary-foreground',
                    )}
                  >
                    <span className="sr-only">
                      {message.role === 'user' ? 'You: ' : 'Claude: '}
                    </span>
                    {text || (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        Thinking…
                      </span>
                    )}
                  </div>
                )}
                {data &&
                  message.attachments.map((attachment, attachmentIndex) =>
                    attachment.type === 'chart' ? (
                      <ChatChart
                        key={attachmentIndex}
                        spec={attachment.spec}
                        targets={attachment.targets}
                        data={data}
                      />
                    ) : (
                      <ChatEditCard
                        key={attachmentIndex}
                        attachment={attachment}
                        weddingId={data.snapshot.wedding.id}
                        snapshot={data.snapshot}
                        onUpdate={(patch) => updateEdit(index, attachmentIndex, patch)}
                      />
                    ),
                  )}
              </div>
            )
          })}

          {error && (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/40 px-4 py-3 text-sm">
              <p className="inline-flex items-start gap-2 text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error.message}
              </p>
              <Button variant="outline" size="sm" onClick={() => ask(error.question)}>
                Try again
              </Button>
            </div>
          )}

          {full && (
            <p className="text-center text-sm text-muted-foreground">
              This chat is full. Start a new chat to keep going.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="border-t bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
          <label htmlFor="chat-question" className="sr-only">
            Your question
          </label>
          <Textarea
            id="chat-question"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            // Like any messaging app: typing brings you back to the latest message.
            onFocus={scrollToLatest}
            placeholder={full ? 'Start a new chat' : 'Ask a question…'}
            maxLength={CHAT_LIMITS.questionChars}
            disabled={!data || full}
            rows={1}
            className="max-h-36 min-h-11 resize-none"
          />
          {streaming ? (
            <Button type="button" size="icon" variant="outline" className="size-11" onClick={stop}>
              <Square aria-hidden="true" />
              <span className="sr-only">Stop answering</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-11"
              disabled={!draft.trim() || !data || full}
            >
              <ArrowUp aria-hidden="true" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

export function ChatPage() {
  const { isPlanner } = useAccess()
  if (isPlanner) return <Conversation />
  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Home" title="Assistant" />
      <PageContainer>
        <h1 className="pt-8 pb-4 text-4xl">Ask about the wedding</h1>
        <PlannerOnly feature="The assistant">{null}</PlannerOnly>
      </PageContainer>
    </>
  )
}
