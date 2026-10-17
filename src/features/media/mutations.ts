import { useSnapshotMutation } from '@/data/queries'
import type { PreparedImage } from '@/data/repository'
import type { Id } from '@/domain/types'

/** Uploads one prepared photo and records it; waits for the server before showing it. */
export function useAddActivityImage() {
  return useSnapshotMutation({
    mutationFn: (
      repository,
      input: { weddingId: Id; activityId: Id; image: PreparedImage; sortOrder: number },
    ) => repository.addActivityImage(input),
    reconcile: (snapshot, image) => ({
      ...snapshot,
      activityImages: [...snapshot.activityImages, image],
    }),
  })
}

/** Sets, replaces or (with null) removes an event cover photo. */
export function useSetEventCover() {
  return useSnapshotMutation({
    mutationFn: (repository, input: { weddingId: Id; eventId: Id; image: PreparedImage | null }) =>
      repository.setEventCover(input),
    reconcile: (snapshot, event) => ({
      ...snapshot,
      events: snapshot.events.map((e) => (e.id === event.id ? event : e)),
    }),
  })
}
