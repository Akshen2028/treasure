import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle, PencilLine, Undo2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { Id, WeddingSnapshot } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

import { type EditFocus, useApplyChatEdit, useUndoChatEdit } from './applyChatEdit'
import type { ChatAttachment } from './useChat'

type EditAttachment = Extract<ChatAttachment, { type: 'edit' }>

const plural = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`

const VIEW_LABEL: Record<EditFocus['kind'], string> = {
  event: 'View event',
  category: 'View category',
  activity: 'View activity',
}

/**
 * A proposal from the assistant. Nothing changes until the planner taps Apply; afterwards
 * the whole proposal can be undone in one go.
 */
export function ChatEditCard({
  attachment,
  weddingId,
  snapshot,
  onUpdate,
}: {
  attachment: EditAttachment
  weddingId: Id
  snapshot: WeddingSnapshot
  onUpdate: (patch: Partial<EditAttachment>) => void
}) {
  const { edit, status, undo, error, focus } = attachment
  const navigate = useNavigate()
  const view = (target: EditFocus) => void navigate(target.path, { viewTransition: true })
  const apply = useApplyChatEdit()
  const revert = useUndoChatEdit()
  const busy = apply.isPending || revert.isPending
  const hasDelete = edit.steps.some(({ step }) => step.op === 'delete')

  async function undoAll(steps = undo) {
    if (!steps?.length) return
    try {
      await revert.mutateAsync(steps)
      onUpdate({ status: 'undone', undo: undefined, error: undefined, focus: undefined })
      toast.success('Changes undone')
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  async function onApply() {
    let result
    try {
      result = await apply.mutateAsync({
        weddingId,
        steps: edit.steps.map(({ step }) => step),
        snapshot,
      })
    } catch (caught) {
      onUpdate({ error: errorMessage(caught) })
      return
    }
    const { focus: target } = result
    if (!result.error) {
      onUpdate({
        status: 'applied',
        undo: result.undo,
        error: undefined,
        focus: target ?? undefined,
      })
      const undoAction = { label: 'Undo', onClick: () => void undoAll(result.undo) }
      // With somewhere to go, "View" leads and Undo sits beside it; otherwise just Undo.
      toast.success(
        `${plural(result.applied)} applied`,
        target
          ? { action: { label: 'View', onClick: () => view(target) }, cancel: undoAction }
          : { action: undoAction },
      )
      return
    }
    const message = errorMessage(result.error)
    if (result.applied === 0) {
      onUpdate({ error: message })
    } else {
      onUpdate({
        status: 'partial',
        undo: result.undo,
        error: message,
        focus: target ?? undefined,
      })
    }
    toast.error(message)
  }

  const settled = status !== 'pending' && status !== 'invalid'

  return (
    <section
      aria-label={`Proposed changes: ${edit.summary}`}
      className={cn(
        'rounded-2xl border bg-card p-5 shadow-soft',
        status === 'pending' && 'border-gold/50',
        settled && 'bg-card/60',
      )}
    >
      <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <PencilLine className="size-3.5" aria-hidden="true" />
        Proposed {edit.steps.length > 1 ? plural(edit.steps.length) : 'change'}
      </p>
      <h3 className="text-xl">{edit.summary}</h3>

      {edit.steps.length > 0 && (
        <ul className={cn('mt-3 flex flex-col gap-2 text-sm', settled && 'text-muted-foreground')}>
          {edit.steps.map(({ text }, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-chart-1" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>
      )}

      {status === 'invalid' && (
        <div className="mt-4 flex flex-col gap-1 text-sm text-destructive">
          {edit.problems.map((problem) => (
            <p key={problem} className="inline-flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {problem}
            </p>
          ))}
          <p className="text-muted-foreground">
            Nothing was changed. Ask the assistant to try again.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 inline-flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {status === 'partial' ? `Stopped partway: ${error}` : error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
        {status === 'pending' && (
          <>
            {/* The spinner takes the label's place at the same size, so nothing beside the
                button moves (iOS Safari can leave a ghost of a button that moves as it fades). */}
            <Button
              onClick={() => void onApply()}
              disabled={busy}
              aria-busy={apply.isPending}
              className="relative"
            >
              <span className={cn(apply.isPending && 'invisible')}>Apply</span>
              {apply.isPending && (
                <LoaderCircle className="absolute animate-spin" aria-label="Applying" />
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onUpdate({ status: 'dismissed' })}
              disabled={busy}
            >
              Dismiss
            </Button>
            {hasDelete && (
              <p className="w-full text-xs text-muted-foreground">
                Deleted items can be restored from Recently Deleted.
              </p>
            )}
          </>
        )}
        {(status === 'applied' || status === 'partial') && (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CircleCheck className="size-4" aria-hidden="true" />
              {status === 'applied' ? 'Applied' : 'Partly applied'}
            </span>
            {focus && (
              <Button size="sm" onClick={() => view(focus)}>
                {VIEW_LABEL[focus.kind]}
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
            {undo && undo.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => void undoAll()} disabled={busy}>
                {revert.isPending ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Undo2 data-icon="inline-start" />
                )}
                Undo
              </Button>
            )}
          </>
        )}
        {status === 'undone' && <span className="text-sm text-muted-foreground">Undone</span>}
        {status === 'dismissed' && (
          <span className="text-sm text-muted-foreground">Dismissed: nothing changed</span>
        )}
      </div>
    </section>
  )
}
