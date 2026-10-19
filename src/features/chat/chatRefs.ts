import { REF_LIMITS, REF_PREFIX, type ChatRef, type RefKind } from '@/domain/chatTools'
import type { ActiveSnapshot } from '@/domain/hierarchy'
import { formatCad } from '@/domain/money'
import { sortEvents } from '@/domain/ordering'
import type { Id } from '@/domain/types'
import { activitiesForCategory, linksForActivity } from '@/features/activities/activityLogic'
import { sortDefinitions } from '@/features/categories/categoryLogic'

export type RefTarget = { kind: RefKind; id: Id }

/** The references sent with one question, and what each one points at. */
export type ChatRefs = { refs: ChatRef[]; targets: Map<string, RefTarget> }

const byOrder = <T extends { sortOrder: number; createdAt: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)

const clip = (text: string) =>
  text.length > REF_LIMITS.nameChars ? `${text.slice(0, REF_LIMITS.nameChars - 1)}…` : text

/**
 * Short references (E1, C1, A1, …) for every active record Claude may point at, in the
 * order the app shows them. They are rebuilt for each question, so they always match the
 * data that question was asked about.
 */
export function buildChatRefs(active: ActiveSnapshot): ChatRefs {
  const refs: ChatRef[] = []
  const targets = new Map<string, RefTarget>()
  const counters: Record<RefKind, number> = {
    definition: 0,
    event: 0,
    category: 0,
    activity: 0,
    payment: 0,
    link: 0,
  }
  const add = (kind: RefKind, id: Id, name: string) => {
    if (refs.length >= REF_LIMITS.count) return
    const ref = `${REF_PREFIX[kind]}${++counters[kind]}`
    refs.push({ ref, kind, name: clip(name) })
    targets.set(ref, { kind, id })
  }

  const definitionNames = new Map(active.categoryDefinitions.map((d) => [d.id, d.name]))
  for (const definition of sortDefinitions(active.categoryDefinitions)) {
    add('definition', definition.id, definition.name)
  }
  for (const event of sortEvents(active.events)) {
    add('event', event.id, event.eventDate ? `${event.name} (${event.eventDate})` : event.name)
    const categories = active.eventCategories.filter((c) => c.eventId === event.id).sort(byOrder)
    for (const category of categories) {
      add('category', category.id, definitionNames.get(category.categoryDefinitionId) ?? 'Category')
      for (const activity of activitiesForCategory(active, category.id)) {
        add('activity', activity.id, activity.name)
        const payments = active.payments
          .filter((p) => p.activityId === activity.id)
          .sort(
            (a, b) => a.paidOn.localeCompare(b.paidOn) || a.createdAt.localeCompare(b.createdAt),
          )
        for (const payment of payments) {
          const note = payment.note ? ` (${payment.note})` : ''
          add(
            'payment',
            payment.id,
            `Payment ${formatCad(payment.amountCents, { cents: 'always' })} on ${payment.paidOn}${note}`,
          )
        }
        for (const link of linksForActivity(active, activity.id)) {
          add('link', link.id, `Link ${link.label || link.url}`)
        }
      }
    }
  }
  return { refs, targets }
}
