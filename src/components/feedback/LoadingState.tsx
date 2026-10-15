import { Skeleton } from '@/components/ui/skeleton'

/** Page-shaped placeholder shown while wedding data loads. */
export function LoadingState({ label = 'Loading wedding details' }: { label?: string }) {
  return (
    <output aria-label={label} className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <span className="sr-only">{label}…</span>
    </output>
  )
}
