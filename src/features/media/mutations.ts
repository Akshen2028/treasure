import { usePrepareNewMedia, useSnapshotMutation } from '@/data/queries'
import type { PreparedImage } from '@/data/repository'
import type { Id } from '@/domain/types'

/**
 * Uploads one prepared photo and records it; waits for the server, and for the new photo's
 * signed URL and thumbnail to load, before showing it.
 */
export function useAddActivityImage() {
  const prepareNewMedia = usePrepareNewMedia()
  return useSnapshotMutation({
    mutationFn: async (
      repository,
      input: { weddingId: Id; activityId: Id; image: PreparedImage; sortOrder: number },
    ) => {
      const image = await repository.addActivityImage(input)
      const tile = image.thumbnailPath ?? image.storagePath
      await prepareNewMedia([image.storagePath, ...(image.thumbnailPath ? [tile] : [])], [tile])
      return image
    },
    reconcile: (snapshot, image) => ({
      ...snapshot,
      activityImages: [...snapshot.activityImages, image],
    }),
  })
}

/** Sets, replaces or (with null) removes an event cover photo. */
export function useSetEventCover() {
  const prepareNewMedia = usePrepareNewMedia()
  return useSnapshotMutation({
    mutationFn: async (
      repository,
      input: { weddingId: Id; eventId: Id; image: PreparedImage | null },
    ) => {
      const event = await repository.setEventCover(input)
      if (event.coverImagePath) {
        await prepareNewMedia([event.coverImagePath], [event.coverImagePath])
      }
      return event
    },
    reconcile: (snapshot, event) => ({
      ...snapshot,
      events: snapshot.events.map((e) => (e.id === event.id ? event : e)),
    }),
  })
}
