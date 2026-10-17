import { useSnapshotMutation } from '@/data/queries'
import type { WeddingPatch } from '@/data/repository'
import { manualBudgetsFromCalculated } from '@/domain/budget'
import type { BudgetMode, Id, WeddingSnapshot } from '@/domain/types'

export function useUpdateWedding() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: WeddingPatch }) =>
      repository.updateWedding(id, patch),
    reconcile: (snapshot, wedding) => ({ ...snapshot, wedding }),
  })
}

/**
 * Switches the whole wedding between auto and manual budgets.
 *
 * Going to manual first saves every event's and category's current calculated total as its
 * manual amount, then flips the mode last. Manual amounts are ignored in auto mode, so if
 * anything fails before the flip, nothing visible changes and the switch can simply be retried.
 */
export function useSwitchBudgetMode() {
  return useSnapshotMutation({
    mutationFn: async (
      repository,
      { snapshot, mode }: { snapshot: WeddingSnapshot; mode: BudgetMode },
    ) => {
      if (mode === 'auto') {
        return repository.updateWedding(snapshot.wedding.id, { budgetMode: 'auto' })
      }
      const seed = manualBudgetsFromCalculated(snapshot)
      await Promise.all([
        ...[...seed.events].map(([id, cents]) =>
          repository.updateEvent(id, { manualBudgetCents: cents }),
        ),
        ...[...seed.categories].map(([id, cents]) =>
          repository.updateEventCategory(id, { manualBudgetCents: cents }),
        ),
      ])
      return repository.updateWedding(snapshot.wedding.id, {
        budgetMode: 'manual',
        manualBudgetCents: seed.weddingCents,
      })
    },
    reconcile: (snapshot, wedding) => ({ ...snapshot, wedding }),
  })
}
