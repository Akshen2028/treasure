import { ChevronRight, CircleOff, ImageIcon, ReceiptText, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { ItemActionsMenu } from '@/components/layout/ItemActionsMenu'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import type { WeddingData } from '@/data/queries'
import { useDeleteWithUndo, useRestoreWithToast } from '@/data/softDelete'
import type { ActivitySummary } from '@/domain/budget'
import { formatCad } from '@/domain/money'
import { ActivityFormSheet } from '@/features/activities/ActivityFormSheet'
import { linksForActivity } from '@/features/activities/activityLogic'
import { ActivityMoney } from '@/features/activities/ActivityMoney'
import { ActivityStatusMenu } from '@/features/activities/ActivityStatusMenu'
import { LinksSection } from '@/features/activities/LinksSection'
import { StatusBadge } from '@/features/activities/StatusBadge'

type Params = { eventId: string; categoryId: string; activityId: string }

function paymentsSummary(summary: ActivitySummary): string {
  if (summary.paymentCount === 0) return 'No payments recorded yet'
  const count = `${summary.paymentCount} payment${summary.paymentCount === 1 ? '' : 's'}`
  const outstanding =
    summary.outstandingCents !== null && summary.outstandingCents > 0
      ? ` · ${formatCad(summary.outstandingCents)} still to pay`
      : ''
  return `${count} · ${formatCad(summary.paidCents)} paid${outstanding}`
}

/** The clearly clickable Payments row leading to the payments screen. */
function PaymentsRow({ to, summary }: { to: string; summary: ActivitySummary }) {
  return (
    <Link
      to={to}
      className="group mt-4 flex min-h-16 items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-gold">
        <ReceiptText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-xl">Payments</span>
        <span className="block truncate text-sm text-muted-foreground">
          {paymentsSummary(summary)}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-2xl">{title}</h2>
      <p className="leading-relaxed whitespace-pre-line">{text}</p>
    </section>
  )
}

function UnavailableActivity({
  data,
  eventId,
  categoryId,
  activityId,
}: { data: WeddingData } & Params) {
  const { isPlanner } = useAccess()
  const { restore, isPending } = useRestoreWithToast()
  const activity = data.snapshot.activities.find(
    (a) => a.id === activityId && a.eventCategoryId === categoryId,
  )
  const categoryActive = data.active.eventCategories.some(
    (c) => c.id === categoryId && c.eventId === eventId,
  )

  let title = 'Activity not found'
  let description = 'It may have been removed, or the link is incorrect.'
  let canRestore = false
  if (activity && !categoryActive) {
    title = 'This activity is hidden'
    description = 'Its event or category was deleted. Restore that first to see it again.'
  } else if (activity?.deletedAt) {
    title = `${activity.name} was deleted`
    description = 'Its payments and links are kept and come back if you restore it.'
    canRestore = isPlanner
  }
  const back = categoryActive ? paths.category(eventId, categoryId) : paths.home

  return (
    <>
      <DetailHeader backTo={back} backLabel={categoryActive ? 'Category' : 'Dashboard'} />
      <PageContainer>
        <EmptyState
          icon={CircleOff}
          title={title}
          description={description}
          action={
            canRestore && activity ? (
              <Button
                disabled={isPending}
                onClick={() => restore({ kind: 'activity', id: activity.id }, activity.name)}
              >
                <RotateCcw data-icon="inline-start" />
                Restore activity
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to={back}>Go back</Link>
              </Button>
            )
          }
          className="my-8"
        />
      </PageContainer>
    </>
  )
}

function ActivityDetails({
  data,
  eventId,
  categoryId,
  activityId,
}: { data: WeddingData } & Params) {
  const { isPlanner } = useAccess()
  const navigate = useNavigate()
  const deleteWithUndo = useDeleteWithUndo()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const summary = data.budget.activities.get(activityId)
  const activity = data.active.activities.find(
    (a) => a.id === activityId && a.eventCategoryId === categoryId,
  )
  const category = data.active.eventCategories.find(
    (c) => c.id === categoryId && c.eventId === eventId,
  )
  const event = data.active.events.find((e) => e.id === eventId)
  const definition = data.active.categoryDefinitions.find(
    (d) => d.id === category?.categoryDefinitionId,
  )
  if (!summary || !activity || !category || !event || !definition) {
    return (
      <UnavailableActivity
        data={data}
        eventId={eventId}
        categoryId={categoryId}
        activityId={activityId}
      />
    )
  }

  const categoryUrl = paths.category(event.id, category.id)

  return (
    <>
      <DetailHeader
        backTo={categoryUrl}
        backLabel={definition.name}
        title={activity.name}
        actions={
          isPlanner && (
            <ItemActionsMenu
              label="Activity actions"
              editLabel="Edit activity"
              deleteLabel="Delete activity"
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )
        }
      />
      <PageContainer>
        <section className="pt-8">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            {event.name} · {definition.name}
          </p>
          <h1 className="mt-1 text-4xl sm:text-5xl">{activity.name}</h1>
          <div className="mt-3">
            {isPlanner ? (
              <ActivityStatusMenu activity={activity} />
            ) : (
              <StatusBadge status={activity.status} className="py-1 text-sm" />
            )}
          </div>
        </section>

        <section
          aria-label="Activity budget"
          className="mt-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
        >
          <ActivityMoney summary={summary} />
        </section>

        <PaymentsRow to={paths.payments(event.id, category.id, activity.id)} summary={summary} />

        {activity.description && <TextBlock title="Description" text={activity.description} />}
        {activity.notes && <TextBlock title="Notes" text={activity.notes} />}

        <section className="mt-8" aria-labelledby="photos-heading">
          <h2 id="photos-heading" className="mb-3 text-2xl">
            Photos
          </h2>
          <p className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
            <ImageIcon className="mr-2 inline size-4 text-gold" aria-hidden="true" />
            Photo uploads arrive in step 10.
          </p>
        </section>

        <LinksSection
          links={linksForActivity(data.active, activity.id)}
          isPlanner={isPlanner}
          weddingId={data.snapshot.wedding.id}
          activityId={activity.id}
        />

        {isPlanner && (
          <>
            <ActivityFormSheet
              open={editing}
              onOpenChange={setEditing}
              weddingId={data.snapshot.wedding.id}
              eventId={event.id}
              eventCategoryId={category.id}
              activity={activity}
            />
            <ConfirmDialog
              open={confirmingDelete}
              onOpenChange={setConfirmingDelete}
              title={`Delete ${activity.name}?`}
              description="Its payments, links and photos will be hidden too. You can restore everything from Recently Deleted."
              confirmLabel="Delete activity"
              destructive
              onConfirm={() => {
                navigate(categoryUrl)
                deleteWithUndo({ kind: 'activity', id: activity.id }, activity.name)
              }}
            />
          </>
        )}
      </PageContainer>
    </>
  )
}

export function ActivityPage() {
  const { eventId = '', categoryId = '', activityId = '' } = useParams()
  return (
    <WeddingDataBoundary
      fallbackHeader={
        <DetailHeader backTo={paths.category(eventId, categoryId)} backLabel="Category" />
      }
    >
      {(data) => (
        <ActivityDetails
          data={data}
          eventId={eventId}
          categoryId={categoryId}
          activityId={activityId}
        />
      )}
    </WeddingDataBoundary>
  )
}
