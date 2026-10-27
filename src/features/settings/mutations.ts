import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useSnapshotMutation } from '@/data/queries'
import type { WeddingPatch, WeddingRepository } from '@/data/repository'
import { useRepository } from '@/data/RepositoryContext'
import { manualBudgetsFromCalculated } from '@/domain/budget'
import { slugError } from '@/domain/slug'
import type { BudgetMode, Id, Wedding, WeddingSnapshot } from '@/domain/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export function useUpdateWedding() {
  return useSnapshotMutation({
    mutationFn: (repository, { id, patch }: { id: Id; patch: WeddingPatch }) =>
      repository.updateWedding(id, patch),
    reconcile: (snapshot, wedding) => ({ ...snapshot, wedding }),
  })
}

/** Who can view the wedding and what guests see: applied at once, rolled back on failure. */
export function useUpdateSharing() {
  return useSnapshotMutation({
    mutationFn: (
      repository,
      { id, patch }: { id: Id; patch: Partial<Pick<Wedding, 'visibility' | 'guestAmounts'>> },
    ) => repository.updateWedding(id, patch),
    optimistic: (snapshot, { patch }) => ({
      ...snapshot,
      wedding: { ...snapshot.wedding, ...patch },
    }),
    reconcile: (snapshot, wedding) => ({ ...snapshot, wedding }),
  })
}

const shareKeyKey = (weddingId: Id) => ['share-key', weddingId] as const

/** The wedding's share key (planners only); never part of the snapshot or exports. */
export function useShareKey(weddingId: Id) {
  const repository = useRepository()
  return useQuery({
    queryKey: shareKeyKey(weddingId),
    queryFn: () => repository.getShareKey(weddingId),
  })
}

export function useResetShareKey(weddingId: Id) {
  const repository = useRepository()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repository.resetShareKey(weddingId),
    onSuccess: (key) => queryClient.setQueryData(shareKeyKey(weddingId), key),
  })
}

/**
 * Live availability of a typed web address, once typing pauses: `idle` when there's nothing
 * to ask (unchanged, or not a valid slug), `unknown` if the check itself failed.
 */
export function useSlugAvailability(slug: string, current: string) {
  const repository = useRepository()
  const debounced = useDebouncedValue(slug, 400)
  const askable = slug !== current && slugError(slug) === null
  const query = useQuery({
    queryKey: ['slug-available', debounced] as const,
    queryFn:
      askable && debounced === slug ? () => repository.isSlugAvailable(debounced) : skipToken,
    staleTime: 10_000,
  })
  if (!askable) return 'idle'
  if (debounced !== slug || query.isPending) return 'checking'
  if (query.isError) return 'unknown'
  return query.data ? 'available' : 'taken'
}

/**
 * Moves the wedding to a new web address; the caller then navigates there, where it loads
 * fresh (queries are keyed by slug, so the old address's cache simply expires).
 */
export function useChangeSlug(weddingId: Id) {
  const repository = useRepository()
  return useMutation({ mutationFn: (slug: string) => repository.changeSlug(weddingId, slug) })
}

/**
 * Switches the whole wedding between auto and manual budgets.
 *
 * Going to manual first saves every event's and category's current calculated total as its
 * manual amount, then flips the mode last. Manual amounts are ignored in auto mode, so if
 * anything fails before the flip, nothing visible changes and the switch can simply be retried.
 */
export async function switchBudgetMode(
  repository: WeddingRepository,
  snapshot: WeddingSnapshot,
  mode: BudgetMode,
) {
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
}

export function useSwitchBudgetMode() {
  return useSnapshotMutation({
    mutationFn: (repository, { snapshot, mode }: { snapshot: WeddingSnapshot; mode: BudgetMode }) =>
      switchBudgetMode(repository, snapshot, mode),
    reconcile: (snapshot, wedding) => ({ ...snapshot, wedding }),
  })
}
