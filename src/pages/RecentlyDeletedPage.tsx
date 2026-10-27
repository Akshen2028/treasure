import {
  CalendarDays,
  ImageIcon,
  LayoutGrid,
  Link2,
  ListChecks,
  type LucideIcon,
  ReceiptText,
  RotateCcw,
  Tag,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useWeddingPaths } from '@/app/WeddingContext'
import { PlannerOnly } from '@/components/auth/PlannerOnly'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import type { WeddingData } from '@/data/queries'
import { useRestoreWithToast } from '@/data/softDelete'
import { formatDate, formatRelative } from '@/domain/dates'
import { type DeletableKind, type DeletedItem, listDeletedItems } from '@/domain/hierarchy'
import { formatCad } from '@/domain/money'
import { linkLabelFallback } from '@/features/activities/links'
import { errorMessage } from '@/lib/errors'

const KIND: Record<DeletableKind, { label: string; icon: LucideIcon }> = {
  event: { label: 'Event', icon: CalendarDays },
  category: { label: 'Category', icon: LayoutGrid },
  definition: { label: 'Custom category', icon: Tag },
  activity: { label: 'Activity', icon: ListChecks },
  payment: { label: 'Payment', icon: ReceiptText },
  link: { label: 'Link', icon: Link2 },
  image: { label: 'Photo', icon: ImageIcon },
}

/** "Just now" / "Yesterday" read mid-sentence; dates like "Sep 26" keep their capital. */
const inSentence = (when: string) =>
  when === 'Just now' || when === 'Yesterday' ? when.toLowerCase() : when

function DeletedRow({ item }: { item: DeletedItem }) {
  const { restore, restoreAsync, isPending } = useRestoreWithToast()
  const [restoringBoth, setRestoringBoth] = useState(false)
  const { icon: Icon, label: kindLabel } = KIND[item.kind]

  // Restoring an item under a deleted parent wouldn't make it visible, so offer both at once.
  async function restoreWithParent() {
    if (!item.hiddenBy) return
    setRestoringBoth(true)
    try {
      await restoreAsync({ kind: item.hiddenBy.kind, id: item.hiddenBy.id }, item.hiddenBy.label)
      await restoreAsync({ kind: item.kind, id: item.id }, item.label)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setRestoringBoth(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center [&+&]:border-t">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-gold">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{item.label}</p>
          <p className="text-sm text-muted-foreground">
            {kindLabel}
            {item.context.length > 0 && ` · ${item.context.join(' › ')}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Deleted{' '}
            <time dateTime={item.deletedAt}>{inSentence(formatRelative(item.deletedAt))}</time>
          </p>
          {item.hiddenBy && (
            <p className="mt-1 text-xs text-warning">
              Hidden because {KIND[item.hiddenBy.kind].label.toLowerCase()} “{item.hiddenBy.label}”
              is also deleted.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
        {item.hiddenBy ? (
          <Button
            size="sm"
            variant="outline"
            disabled={restoringBoth}
            onClick={() => void restoreWithParent()}
          >
            <RotateCcw data-icon="inline-start" />
            Restore with {item.hiddenBy.label}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => restore({ kind: item.kind, id: item.id }, item.label)}
          >
            <RotateCcw data-icon="inline-start" />
            Restore
          </Button>
        )}
      </div>
    </li>
  )
}

function DeletedList({ data }: { data: WeddingData }) {
  const items = listDeletedItems(
    data.snapshot,
    (p) => `${formatCad(p.amountCents)} on ${formatDate(p.paidOn)}`,
    (l) => l.label || linkLabelFallback(l.url),
  )

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title="Nothing deleted"
        description="Deleted events, categories, activities, payments, photos and links appear here so you can restore them."
        className="my-8"
      />
    )
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {items.length} deleted item{items.length === 1 ? '' : 's'}, newest first. Restoring brings
        back everything that was inside it.
      </p>
      <ul className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {items.map((item) => (
          <DeletedRow key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </ul>
    </>
  )
}

export function RecentlyDeletedPage() {
  const paths = useWeddingPaths()
  return (
    <>
      <DetailHeader backTo={paths.settings} backLabel="Settings" title="Recently Deleted" />
      <PageContainer>
        <h1 className="pt-8 pb-5 text-4xl">Recently Deleted</h1>
        <PlannerOnly feature="Recently Deleted">
          <WeddingDataBoundary>{(data) => <DeletedList data={data} />}</WeddingDataBoundary>
        </PlannerOnly>
      </PageContainer>
    </>
  )
}
