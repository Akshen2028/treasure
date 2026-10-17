import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { type PointerEvent, useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

import { SafeImage } from './SafeImage'

export type LightboxImage = { id: string; url: string; alt: string }

type LightboxProps = {
  images: LightboxImage[]
  /** Index of the open image, or null when closed. */
  index: number | null
  onIndexChange: (index: number | null) => void
  /** Planners can remove the current photo. */
  onRemove?: (image: LightboxImage) => void
}

const SWIPE_THRESHOLD = 50

/** Full-screen photo viewer: swipe or arrow keys to move, Escape or ✕ to close. */
export function Lightbox({ images, index, onIndexChange, onRemove }: LightboxProps) {
  const open = index !== null && images.length > 0
  const current = open ? images[Math.min(index, images.length - 1)] : undefined
  const swipeStart = useRef<number | null>(null)

  const go = (delta: number) => {
    if (index === null || images.length === 0) return
    onIndexChange((index + delta + images.length) % images.length)
  }

  // If the open photo is removed, keep the index in range (or close when none are left).
  useEffect(() => {
    if (index === null) return
    if (images.length === 0) onIndexChange(null)
    else if (index >= images.length) onIndexChange(images.length - 1)
  }, [images.length, index, onIndexChange])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') go(1)
    if (event.key === 'ArrowLeft') go(-1)
  }

  function onPointerDown(event: PointerEvent) {
    swipeStart.current = event.clientX
  }

  function onPointerUp(event: PointerEvent) {
    if (swipeStart.current === null) return
    const delta = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(delta < 0 ? 1 : -1)
  }

  const multiple = images.length > 1

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none data-open:animate-in data-open:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">
            {current ? current.alt : 'Photo viewer'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {multiple ? 'Swipe or use the arrow keys to see other photos.' : 'Photo'}
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between gap-2 px-2 pt-safe">
            <p className="px-3 text-sm text-white/80 tabular-nums" aria-live="polite">
              {multiple && index !== null && `${index + 1} / ${images.length}`}
            </p>
            <div className="flex items-center gap-1">
              {onRemove && current && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => onRemove(current)}
                  aria-label="Remove this photo"
                >
                  <Trash2 />
                </Button>
              )}
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="Close photo viewer"
                >
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            className="relative flex flex-1 touch-pan-y items-center justify-center px-2 pb-safe select-none"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            {current && (
              <SafeImage
                key={current.id}
                src={current.url}
                alt={current.alt}
                draggable={false}
                className="max-h-[calc(100dvh-7rem)] max-w-full animate-in rounded-lg bg-transparent object-contain duration-200 fade-in-0"
              />
            )}
            {multiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="absolute top-1/2 left-1 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="absolute top-1/2 right-1 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
