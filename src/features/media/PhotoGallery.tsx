import { ImageIcon, ImagePlus, LoaderCircle } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useDeleteWithUndo } from '@/data/softDelete'
import type { ActivityImage, Id } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { Lightbox, type LightboxImage } from './Lightbox'
import { useAddActivityImage } from './mutations'
import { ImagePrepError, prepareImage } from './prepareImage'
import { SafeImage } from './SafeImage'
import { useMediaUrl } from '@/data/queries'

type PhotoGalleryProps = {
  images: ActivityImage[]
  activityName: string
  isPlanner: boolean
  weddingId: Id
  activityId: Id
}

/** `added` counts successful uploads; `baseline` is how many photos there were before. */
type Progress = { done: number; total: number; added: number; baseline: number }

/** Thumbnail grid with full-screen viewing; planners can add and remove photos. */
export function PhotoGallery({
  images,
  activityName,
  isPlanner,
  weddingId,
  activityId,
}: PhotoGalleryProps) {
  const mediaUrl = useMediaUrl()
  const addImage = useAddActivityImage()
  const deleteWithUndo = useDeleteWithUndo()
  const inputRef = useRef<HTMLInputElement>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)

  const viewerImages: LightboxImage[] = images.map((image, i) => ({
    id: image.id,
    url: mediaUrl(image.storagePath),
    alt: `${activityName}, photo ${i + 1}`,
  }))

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = '' // allow picking the same file again
    if (files.length === 0) return

    const baseline = images.length
    setProgress({ done: 0, total: files.length, added: 0, baseline })
    let added = 0
    const nextSort = images.reduce((max, image) => Math.max(max, image.sortOrder), 0) + 1
    // One at a time keeps memory low on phones and gives clear progress.
    for (const [i, file] of files.entries()) {
      try {
        const prepared = await prepareImage(file)
        await addImage.mutateAsync({
          weddingId,
          activityId,
          image: prepared,
          sortOrder: nextSort + i,
        })
        added++
      } catch (error) {
        toast.error(error instanceof ImagePrepError ? error.message : errorMessage(error))
      }
      setProgress({ done: i + 1, total: files.length, added, baseline })
    }
    setProgress(null)
    if (added > 0) toast.success(added === 1 ? 'Photo added' : `${added} photos added`)
  }

  if (!isPlanner && images.length === 0) return null

  return (
    <section className="mt-8" aria-labelledby="photos-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="photos-heading" className="text-2xl">
          Photos
        </h2>
        {isPlanner && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFiles}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={progress !== null}
              onClick={() => inputRef.current?.click()}
            >
              {progress ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <ImagePlus data-icon="inline-start" />
              )}
              {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : 'Add photos'}
            </Button>
          </>
        )}
      </div>

      {images.length === 0 && !progress ? (
        <p className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          <ImageIcon className="mr-2 inline size-4 text-gold" aria-hidden="true" />
          No photos yet. Add inspiration, quotes or the real thing.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="block aspect-square w-full overflow-hidden rounded-xl transition-opacity hover:opacity-90"
                aria-label={`Open ${activityName} photo ${i + 1} of ${images.length}`}
              >
                <SafeImage
                  src={mediaUrl(image.thumbnailPath ?? image.storagePath)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
          {/* Hidden as soon as the photo being uploaded appears, before the save fully settles. */}
          {progress && images.length <= progress.baseline + progress.added && (
            <li
              aria-hidden="true"
              className="grid aspect-square animate-pulse place-items-center rounded-xl bg-muted text-muted-foreground"
            >
              <LoaderCircle className="size-5 animate-spin" />
            </li>
          )}
        </ul>
      )}

      <Lightbox
        images={viewerImages}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onRemove={
          isPlanner
            ? (image) => deleteWithUndo({ kind: 'image', id: image.id }, 'Photo')
            : undefined
        }
      />
    </section>
  )
}
