import { useSnapshotMutation } from '@/data/queries'
import type { EventPatch, NewEvent } from '@/data/repository'
import type { Id } from '@/domain/types'

/** Waits for the server, then adds the saved event to the cache before the refetch. */
export function useCreateEvent() {
  return useSnapshotMutation({
    mutationFn: (repository, input: NewEvent) => repository.createEvent(input),
    reconcile: (snapshot, event) => ({ ...snapshot, events: [...snapshot.events, event] }),
  })
}

export function useUpdateEvent() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: EventPatch }) =>
      repository.updateEvent(id, patch),
    reconcile: (snapshot, event) => ({
      ...snapshot,
      events: snapshot.events.map((e) => (e.id === event.id ? event : e)),
    }),
  })
}
