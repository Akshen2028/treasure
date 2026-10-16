import { useSnapshotMutation } from '@/data/queries'
import type {
  ActivityLinkPatch,
  ActivityPatch,
  NewActivity,
  NewActivityLink,
} from '@/data/repository'
import type { ActivityStatus, Id } from '@/domain/types'

export function useCreateActivity() {
  return useSnapshotMutation({
    mutationFn: (repository, input: NewActivity) => repository.createActivity(input),
    reconcile: (snapshot, activity) => ({
      ...snapshot,
      activities: [...snapshot.activities, activity],
    }),
  })
}

export function useUpdateActivity() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: ActivityPatch }) =>
      repository.updateActivity(id, patch),
    reconcile: (snapshot, activity) => ({
      ...snapshot,
      activities: snapshot.activities.map((a) => (a.id === activity.id ? activity : a)),
    }),
  })
}

/** Status changes are small and reversible, so they show immediately and roll back on failure. */
export function useSetActivityStatus() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, status }: { id: Id; status: ActivityStatus }) =>
      repository.updateActivity(id, { status }),
    optimistic: (snapshot, { id, status }) => ({
      ...snapshot,
      activities: snapshot.activities.map((a) => (a.id === id ? { ...a, status } : a)),
    }),
  })
}

export function useCreateLink() {
  return useSnapshotMutation({
    mutationFn: (repository, input: NewActivityLink) => repository.createActivityLink(input),
    reconcile: (snapshot, link) => ({
      ...snapshot,
      activityLinks: [...snapshot.activityLinks, link],
    }),
  })
}

export function useUpdateLink() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: ActivityLinkPatch }) =>
      repository.updateActivityLink(id, patch),
    reconcile: (snapshot, link) => ({
      ...snapshot,
      activityLinks: snapshot.activityLinks.map((l) => (l.id === link.id ? link : l)),
    }),
  })
}
