import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { useWeddingRoute } from '@/app/WeddingContext'
import { useAccess } from '@/auth/AccessContext'
import { type BudgetIndex, computeBudgetIndex } from '@/domain/budget'
import { budgetIndexFromFigures } from '@/domain/guestFigures'
import { type ActiveSnapshot, selectActive } from '@/domain/hierarchy'
import type { WeddingSnapshot } from '@/domain/types'

import { useRepository } from './RepositoryContext'
import type { Audience, WeddingRepository } from './repository'

/**
 * Planners and guests receive different snapshots (planners also get soft-deleted records),
 * so each audience has its own cache entry. Guests' entries also carry the share key, so a
 * wrong or reset key never shows a copy loaded with another.
 */
export const weddingKeys = {
  all: ['wedding'] as const,
  snapshot: (slug: string, audience: Audience, shareKey: string | null) =>
    ['wedding', slug, audience, shareKey] as const,
  /** Every planner snapshot, of any wedding (dropped when the planner signs out). */
  isPlanner: (queryKey: readonly unknown[]) =>
    queryKey[0] === 'wedding' && queryKey[2] === 'planner',
}

/**
 * Signed media URLs live outside `weddingKeys.all`, so saving an edit (which refetches the
 * wedding) doesn't re-sign every photo and make them all reload.
 */
const mediaKey = (slug: string, audience: Audience, shareKey: string | null, paths: string[]) =>
  ['media', slug, audience, shareKey, paths] as const

/** URLs signed straight after an upload, used until the full list is re-signed. */
const freshMediaKey = (slug: string, audience: Audience) => ['media-fresh', slug, audience] as const

/** Which wedding is shown (from the URL), and the share key that opens it if it is private. */
function useWeddingTarget() {
  const { isPlanner } = useAccess()
  const { slug, shareKey } = useWeddingRoute()
  const audience: Audience = isPlanner ? 'planner' : 'guest'
  // Planners read their own wedding directly; the key only matters to guests.
  return { slug, shareKey: isPlanner ? null : shareKey, audience }
}

export function useSnapshotKey() {
  const { slug, shareKey, audience } = useWeddingTarget()
  return weddingKeys.snapshot(slug, audience, shareKey)
}

export function useWeddingSnapshot() {
  const repository = useRepository()
  const { slug, shareKey, audience } = useWeddingTarget()
  return useQuery({
    queryKey: weddingKeys.snapshot(slug, audience, shareKey),
    queryFn: () =>
      audience === 'planner'
        ? repository.loadSnapshot(slug)
        : repository.loadGuestView(slug, shareKey),
  })
}

/**
 * True when this viewer sees shares of the total budget instead of amounts (guests of a
 * wedding in percentage mode). Every `…Cents` figure in the budget index is then a share;
 * format with `formatShare`.
 */
export function useShowsShares(): boolean {
  return useWeddingSnapshot().data?.guestFigures != null
}

export type WeddingData = {
  /** Everything loaded, including soft-deleted records for planners. */
  snapshot: WeddingSnapshot
  /** Only records that are active and have active ancestors. */
  active: ActiveSnapshot
  /** Budget, paid and progress for every level (shares, not cents, when `showsShares`). */
  budget: BudgetIndex
  /** Guests of a wedding in percentage mode: figures are shares of the total budget. */
  showsShares: boolean
}

/** The wedding plus everything derived from it, recomputed only when the data changes. */
export function useWeddingData() {
  const query = useWeddingSnapshot()
  const data = useMemo<WeddingData | undefined>(
    () =>
      query.data && {
        snapshot: query.data,
        active: selectActive(query.data),
        budget: query.data.guestFigures
          ? budgetIndexFromFigures(query.data, query.data.guestFigures)
          : computeBudgetIndex(query.data),
        showsShares: query.data.guestFigures != null,
      },
    [query.data],
  )
  return { ...query, data }
}

/** Every stored media path in a snapshot, sorted so the list is a stable cache key. */
function mediaPaths(snapshot: WeddingSnapshot): string[] {
  const paths = new Set<string>()
  for (const e of snapshot.events) if (e.coverImagePath) paths.add(e.coverImagePath)
  for (const i of snapshot.activityImages) {
    paths.add(i.storagePath)
    if (i.thumbnailPath) paths.add(i.thumbnailPath)
  }
  return [...paths].sort()
}

/** Signed URLs last an hour; refresh well before they expire. */
const MEDIA_REFRESH_MS = 45 * 60 * 1000

/**
 * Resolves stored media paths to signed URLs. Returns undefined while the URLs load (or
 * if they couldn't), so images simply wait instead of breaking.
 */
export function useMediaUrl(): (path: string) => string | undefined {
  const repository = useRepository()
  const { slug, shareKey, audience } = useWeddingTarget()
  const snapshot = useWeddingSnapshot().data
  const paths = useMemo(() => (snapshot ? mediaPaths(snapshot) : []), [snapshot])
  const { data: urls } = useQuery({
    queryKey: mediaKey(slug, audience, shareKey, paths),
    queryFn: () => repository.signMedia({ audience, slug, shareKey, paths }),
    enabled: paths.length > 0,
    staleTime: MEDIA_REFRESH_MS,
    refetchInterval: MEDIA_REFRESH_MS,
    // Keep showing the current photos while a changed list of paths is signed.
    placeholderData: (previous) => previous,
  })
  const { data: fresh } = useQuery<Record<string, string>>({
    queryKey: freshMediaKey(slug, audience),
    queryFn: () => ({}),
    enabled: false,
    staleTime: Infinity,
  })
  return useCallback((path: string) => urls?.[path] ?? fresh?.[path], [urls, fresh])
}

/** Resolves once the image has downloaded and decoded (or failed), so it can show at once. */
function preload(url: string): Promise<void> {
  const image = new Image()
  image.src = url
  return image.decode().catch(() => {})
}

/**
 * Signs newly uploaded media and waits for `show` paths to load, so a new photo appears
 * complete instead of as an empty tile while its URL is fetched. Failures are ignored: the
 * regular re-signing picks the photo up moments later.
 */
export function usePrepareNewMedia() {
  const repository = useRepository()
  const queryClient = useQueryClient()
  const { slug, shareKey, audience } = useWeddingTarget()
  return useCallback(
    async (paths: string[], show: string[]) => {
      const urls = await repository
        .signMedia({ audience, slug, shareKey, paths })
        .catch(() => ({}) as Record<string, string>)
      queryClient.setQueryData<Record<string, string>>(freshMediaKey(slug, audience), (prev) => ({
        ...prev,
        ...urls,
      }))
      await Promise.all(show.flatMap((path) => (urls[path] ? [preload(urls[path])] : [])))
    },
    [repository, queryClient, slug, shareKey, audience],
  )
}

type SnapshotMutationOptions<TVariables, TResult> = {
  mutationFn: (repository: WeddingRepository, variables: TVariables) => Promise<TResult>
  /**
   * Applies the change to the cached snapshot immediately. Use only for safe, reversible
   * edits; it is rolled back automatically if the server refuses the write.
   */
  optimistic?: (snapshot: WeddingSnapshot, variables: TVariables) => WeddingSnapshot
  /** Folds the server's result into the cache before the background refetch. */
  reconcile?: (snapshot: WeddingSnapshot, result: TResult, variables: TVariables) => WeddingSnapshot
  /**
   * Side effects such as toasts. Unlike callbacks passed to `mutate`, these still run if
   * the component that started the mutation unmounts (e.g. after navigating away).
   */
  onSuccess?: (result: TResult, variables: TVariables) => void
  onError?: (error: unknown, variables: TVariables) => void
}

/**
 * Standard write path: run the repository call, optionally update the cache optimistically,
 * roll back on failure, then refetch so every derived total comes from the server.
 */
export function useSnapshotMutation<TVariables, TResult>({
  mutationFn,
  optimistic,
  reconcile,
  onSuccess,
  onError,
}: SnapshotMutationOptions<TVariables, TResult>) {
  const repository = useRepository()
  const queryClient = useQueryClient()
  const queryKey = useSnapshotKey()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(repository, variables),
    onMutate: async (variables) => {
      if (!optimistic) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<WeddingSnapshot>(queryKey)
      if (previous) queryClient.setQueryData(queryKey, optimistic(previous, variables))
      return { previous }
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      onError?.(error, variables)
    },
    onSuccess: (result, variables) => {
      if (reconcile) {
        queryClient.setQueryData<WeddingSnapshot>(queryKey, (current) =>
          current ? reconcile(current, result, variables) : current,
        )
      }
      onSuccess?.(result, variables)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weddingKeys.all }),
  })
}
