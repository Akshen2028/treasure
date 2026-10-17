import { ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Button } from '@/components/ui/button'
import type { WeddingEvent } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { useSetEventCover } from './mutations'
import { ImagePrepError, prepareImage } from './prepareImage'
import { SafeImage } from './SafeImage'
import { useMediaUrl } from './useMediaUrl'

/** The event page's cover photo; planners can add, change or remove it. */
export function EventCover({ event, isPlanner }: { event: WeddingEvent; isPlanner: boolean }) {
  const mediaUrl = useMediaUrl()
  const setCover = useSetEventCover()
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const busy = setCover.isPending

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const image = await prepareImage(file)
      await setCover.mutateAsync({ weddingId: event.weddingId, eventId: event.id, image })
      toast.success('Cover photo updated')
    } catch (error) {
      toast.error(error instanceof ImagePrepError ? error.message : errorMessage(error))
    }
  }

  if (!isPlanner && !event.coverImagePath) return null

  const picker = isPlanner && (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={handleFile}
    />
  )

  if (!event.coverImagePath) {
    return (
      <div className="pt-6">
        {picker}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/6] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin text-gold" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-5 text-gold" aria-hidden="true" />
          )}
          {busy ? 'Uploading cover…' : 'Add a cover photo'}
        </button>
      </div>
    )
  }

  return (
    <div className="relative pt-6">
      {picker}
      <SafeImage
        src={mediaUrl(event.coverImagePath)}
        alt={`${event.name} cover photo`}
        className="aspect-[16/7] w-full rounded-2xl object-cover shadow-soft"
      />
      {isPlanner && (
        <div className="absolute right-3 bottom-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-card/90 backdrop-blur"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Change
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            className="bg-card/90 backdrop-blur"
            disabled={busy}
            onClick={() => setConfirmingRemove(true)}
            aria-label="Remove cover photo"
          >
            <Trash2 />
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title="Remove the cover photo?"
        description="The event will show without a cover image. You can add a new one any time."
        confirmLabel="Remove cover"
        destructive
        onConfirm={() =>
          setCover.mutate(
            { weddingId: event.weddingId, eventId: event.id, image: null },
            {
              onSuccess: () => toast.success('Cover photo removed'),
              onError: (error) => toast.error(errorMessage(error)),
            },
          )
        }
      />
    </div>
  )
}
