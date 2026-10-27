import { weddingPaths } from '@/app/paths'
import { useWeddingRoute } from '@/app/WeddingContext'
import { useSnapshotMutation } from '@/data/queries'
import type { WeddingRepository } from '@/data/repository'
import type { Id, WeddingSnapshot } from '@/domain/types'
import { switchBudgetMode } from '@/features/settings/mutations'

import type { EditStep, ParentRef } from './chatEdits'

type Undo = () => Promise<unknown>

/** The page that best shows what changed, for a "View" button. */
export type EditFocus = { kind: 'event' | 'category' | 'activity'; path: string }

export type ApplyResult = {
  applied: number
  total: number
  /** Reverses the applied steps, newest first. */
  undo: Undo[]
  /** From the last applied step that has a page (wedding-wide changes don't). */
  focus: EditFocus | null
  error?: unknown
}

/**
 * Runs the steps in order, stopping at the first failure. Every applied step records how to
 * reverse it: updates restore the previous values, creations and deletions are soft-deleted
 * or restored. The database (RLS) still decides whether each write is allowed.
 */
export async function runEditSteps(
  repository: WeddingRepository,
  weddingId: Id,
  /** The wedding's URL slug, for links to changed pages. */
  slug: string,
  steps: EditStep[],
  /** The data the proposal was made against, to find each record's page. */
  snapshot: WeddingSnapshot,
): Promise<ApplyResult> {
  const created = new Map<string, Id>()
  const undo: Undo[] = []

  // Parents of every record, so any change can link to its page; new records are added as
  // they are created.
  const eventOfCategory = new Map(snapshot.eventCategories.map((c) => [c.id, c.eventId]))
  const categoryOfActivity = new Map(snapshot.activities.map((a) => [a.id, a.eventCategoryId]))
  const activityOf = new Map([
    ...snapshot.payments.map((p) => [p.id, p.activityId] as const),
    ...snapshot.activityLinks.map((l) => [l.id, l.activityId] as const),
  ])
  const paths = weddingPaths(slug)
  let focus: EditFocus | null = null
  const showEvent = (eventId: Id) => {
    focus = { kind: 'event', path: paths.event(eventId) }
  }
  const showCategory = (categoryId: Id) => {
    const eventId = eventOfCategory.get(categoryId)
    if (eventId) focus = { kind: 'category', path: paths.category(eventId, categoryId) }
  }
  const showActivity = (activityId: Id | undefined) => {
    const categoryId = activityId && categoryOfActivity.get(activityId)
    const eventId = categoryId && eventOfCategory.get(categoryId)
    if (activityId && categoryId && eventId) {
      focus = { kind: 'activity', path: paths.activity(eventId, categoryId, activityId) }
    }
  }
  const idOf = (ref: ParentRef) => {
    if ('id' in ref) return ref.id
    const id = created.get(ref.created)
    if (!id) throw new Error(`${ref.created} wasn’t created`)
    return id
  }

  async function run(step: EditStep) {
    switch (step.op) {
      case 'update_wedding':
        await repository.updateWedding(step.id, step.patch)
        undo.push(() => repository.updateWedding(step.id, step.before))
        return
      case 'set_budget_mode': {
        // Seeds manual amounts from the latest totals, including earlier steps.
        const latest = await repository.loadSnapshot(slug)
        const previous = latest.wedding.budgetMode
        await switchBudgetMode(repository, latest, step.mode)
        // Flipping back is enough: the other mode's amounts were left untouched.
        undo.push(() => repository.updateWedding(weddingId, { budgetMode: previous }))
        return
      }
      case 'create_event': {
        const event = await repository.createEvent({ weddingId, ...step.input })
        if (step.as) created.set(step.as, event.id)
        undo.push(() => repository.softDelete('event', event.id))
        showEvent(event.id)
        return
      }
      case 'update_event':
        await repository.updateEvent(step.id, step.patch)
        undo.push(() => repository.updateEvent(step.id, step.before))
        showEvent(step.id)
        return
      case 'add_category': {
        let definitionId = step.definitionId
        if (!definitionId) {
          const definition = await repository.createCategoryDefinition({
            weddingId,
            name: step.newName ?? '',
          })
          definitionId = definition.id
          undo.push(() => repository.softDelete('definition', definition.id))
        }
        const category = await repository.createEventCategory({
          weddingId,
          eventId: idOf(step.event),
          categoryDefinitionId: definitionId,
          ...(step.manualBudgetCents !== undefined && {
            manualBudgetCents: step.manualBudgetCents,
          }),
        })
        if (step.as) created.set(step.as, category.id)
        undo.push(() => repository.softDelete('category', category.id))
        eventOfCategory.set(category.id, category.eventId)
        showCategory(category.id)
        return
      }
      case 'update_category': {
        const { name, manualBudgetCents } = step
        if (name) {
          await repository.renameCategoryDefinition(step.definitionId, name.after)
          undo.push(() => repository.renameCategoryDefinition(step.definitionId, name.before))
        }
        if (manualBudgetCents) {
          await repository.updateEventCategory(step.id, {
            manualBudgetCents: manualBudgetCents.after,
          })
          undo.push(() =>
            repository.updateEventCategory(step.id, {
              manualBudgetCents: manualBudgetCents.before,
            }),
          )
        }
        showCategory(step.id)
        return
      }
      case 'create_activity': {
        const activity = await repository.createActivity({
          weddingId,
          eventCategoryId: idOf(step.category),
          ...step.input,
        })
        if (step.as) created.set(step.as, activity.id)
        undo.push(() => repository.softDelete('activity', activity.id))
        categoryOfActivity.set(activity.id, activity.eventCategoryId)
        showActivity(activity.id)
        return
      }
      case 'update_activity':
        await repository.updateActivity(step.id, step.patch)
        undo.push(() => repository.updateActivity(step.id, step.before))
        showActivity(step.id)
        return
      case 'add_payment': {
        const payment = await repository.createPayment({
          weddingId,
          activityId: idOf(step.activity),
          amountCents: step.amountCents,
          paidOn: step.paidOn,
          note: step.note,
        })
        undo.push(() => repository.softDelete('payment', payment.id))
        showActivity(payment.activityId)
        return
      }
      case 'update_payment':
        await repository.updatePayment(step.id, step.patch)
        undo.push(() => repository.updatePayment(step.id, step.before))
        showActivity(activityOf.get(step.id))
        return
      case 'add_link': {
        const link = await repository.createActivityLink({
          weddingId,
          activityId: idOf(step.activity),
          url: step.url,
          label: step.label,
        })
        undo.push(() => repository.softDelete('link', link.id))
        showActivity(link.activityId)
        return
      }
      case 'update_link':
        await repository.updateActivityLink(step.id, step.patch)
        undo.push(() => repository.updateActivityLink(step.id, step.before))
        showActivity(activityOf.get(step.id))
        return
      case 'delete':
        await repository.softDelete(step.kind, step.id)
        undo.push(() => repository.restore(step.kind, step.id))
        // A deleted record has no page; show where it was.
        if (step.kind === 'payment' || step.kind === 'link') showActivity(activityOf.get(step.id))
        else if (step.kind === 'activity') {
          const categoryId = categoryOfActivity.get(step.id)
          if (categoryId) showCategory(categoryId)
        } else if (step.kind === 'category') {
          const eventId = eventOfCategory.get(step.id)
          if (eventId) showEvent(eventId)
        }
        return
    }
  }

  let applied = 0
  for (const step of steps) {
    try {
      await run(step)
      applied++
    } catch (error) {
      return { applied, total: steps.length, undo: undo.reverse(), focus, error }
    }
  }
  return { applied, total: steps.length, undo: undo.reverse(), focus }
}

/** Applies a reviewed proposal; the snapshot refetches afterwards so every total is fresh. */
export function useApplyChatEdit() {
  const { slug } = useWeddingRoute()
  return useSnapshotMutation({
    mutationFn: (
      repository,
      {
        weddingId,
        steps,
        snapshot,
      }: { weddingId: Id; steps: EditStep[]; snapshot: WeddingSnapshot },
    ) => runEditSteps(repository, weddingId, slug, steps, snapshot),
  })
}

/** Reverses an applied proposal, newest change first; stops at the first failure. */
export function useUndoChatEdit() {
  return useSnapshotMutation({
    mutationFn: async (_repository, undo: Undo[]) => {
      for (const step of undo) await step()
    },
  })
}
