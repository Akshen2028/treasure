import type { ActiveSnapshot } from '@/domain/hierarchy'
import type { Activity, ActivityLink, Id } from '@/domain/types'

const byOrder = <T extends { sortOrder: number; createdAt: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)

/** A category's active activities in display order. */
export function activitiesForCategory(active: ActiveSnapshot, eventCategoryId: Id): Activity[] {
  return active.activities.filter((a) => a.eventCategoryId === eventCategoryId).sort(byOrder)
}

/** An activity's active links in display order. */
export function linksForActivity(active: ActiveSnapshot, activityId: Id): ActivityLink[] {
  return active.activityLinks.filter((l) => l.activityId === activityId).sort(byOrder)
}
