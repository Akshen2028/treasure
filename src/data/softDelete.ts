import { toast } from 'sonner'

import type { Id, WeddingSnapshot } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { useSnapshotMutation } from './queries'
import type { SoftDeletableKind } from './repository'

const COLLECTION = {
  definition: 'categoryDefinitions',
  event: 'events',
  category: 'eventCategories',
  activity: 'activities',
  payment: 'payments',
  link: 'activityLinks',
  image: 'activityImages',
} as const satisfies Record<SoftDeletableKind, keyof WeddingSnapshot>

type Target = { kind: SoftDeletableKind; id: Id }
type LabelledTarget = Target & { label: string }

/** Returns a copy of the snapshot with one record's deletedAt changed. */
export function withDeletedAt(
  snapshot: WeddingSnapshot,
  { kind, id }: Target,
  deletedAt: string | null,
): WeddingSnapshot {
  const key = COLLECTION[kind]
  const rows = snapshot[key] as Array<{ id: Id; deletedAt: string | null }>
  return { ...snapshot, [key]: rows.map((r) => (r.id === id ? { ...r, deletedAt } : r)) }
}

/*
 * Toasts are attached to the mutations themselves (not to `mutate` calls) so they still
 * appear when the component that triggered them unmounts — which is common here, because
 * deleting or restoring immediately changes what the page shows.
 */

/** Restores a record immediately in the UI and confirms with a toast; rolls back on failure. */
export function useRestoreWithToast() {
  const mutation = useSnapshotMutation({
    mutationFn: (repository, target: LabelledTarget) => repository.restore(target.kind, target.id),
    optimistic: (snapshot, target) => withDeletedAt(snapshot, target, null),
    onSuccess: (_, target) => toast.success(`${target.label} restored`),
    onError: (error) => toast.error(errorMessage(error)),
  })
  return {
    restore: (target: Target, label: string) => mutation.mutate({ ...target, label }),
    /** Awaitable, for restoring a parent before its child. */
    restoreAsync: (target: Target, label: string) => mutation.mutateAsync({ ...target, label }),
    isPending: mutation.isPending,
  }
}

/** Soft-deletes a record immediately and offers Undo; rolls back on failure. */
export function useDeleteWithUndo() {
  const { restore } = useRestoreWithToast()
  const mutation = useSnapshotMutation({
    mutationFn: (repository, target: LabelledTarget) =>
      repository.softDelete(target.kind, target.id),
    optimistic: (snapshot, target) => withDeletedAt(snapshot, target, new Date().toISOString()),
    onSuccess: (_, target) =>
      toast(`${target.label} deleted`, {
        description: 'You can also restore it from Recently Deleted.',
        action: { label: 'Undo', onClick: () => restore(target, target.label) },
      }),
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (target: Target, label: string) => mutation.mutate({ ...target, label })
}
