import { CircleOff, ListChecks, Plus, RotateCcw, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { BudgetFigures } from '@/components/budget/BudgetFigures'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { ItemActionsMenu } from '@/components/layout/ItemActionsMenu'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import type { WeddingData } from '@/data/queries'
import { useAmountFormat } from '@/components/budget/useAmountFormat'
import { useDeleteWithUndo, useRestoreWithToast } from '@/data/softDelete'
import { ActivityCard } from '@/features/activities/ActivityCard'
import { ActivityFormSheet } from '@/features/activities/ActivityFormSheet'
import { activitiesForCategory } from '@/features/activities/activityLogic'
import { otherEventsUsing } from '@/features/categories/categoryLogic'
import { EditCategorySheet } from '@/features/categories/EditCategorySheet'

type Params = { eventId: string; categoryId: string }

function ActivitiesSection({
  data,
  eventId,
  eventCategoryId,
}: {
  data: WeddingData
  eventId: string
  eventCategoryId: string
}) {
  const { isPlanner } = useAccess()
  const [adding, setAdding] = useState(false)
  const activities = activitiesForCategory(data.active, eventCategoryId)

  return (
    <section className="mt-10" aria-labelledby="activities-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="activities-heading" className="text-3xl">
          Activities
        </h2>
        {isPlanner && activities.length > 0 && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add activity
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No activities yet"
          description={
            isPlanner
              ? 'Add the things to book or buy, each with its own budget and payments.'
              : 'The planners haven’t added activities here yet.'
          }
          action={
            isPlanner && (
              <Button onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                Add an activity
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {activities.map((activity) => {
            const summary = data.budget.activities.get(activity.id)
            return (
              summary && (
                <li key={activity.id}>
                  <ActivityCard
                    to={paths.activity(eventId, eventCategoryId, activity.id)}
                    activity={activity}
                    summary={summary}
                  />
                </li>
              )
            )
          })}
        </ul>
      )}

      {isPlanner && (
        <ActivityFormSheet
          open={adding}
          onOpenChange={setAdding}
          weddingId={data.snapshot.wedding.id}
          eventId={eventId}
          eventCategoryId={eventCategoryId}
        />
      )}
    </section>
  )
}

/** Explains why a category can't be shown, offering restore where that would help. */
function UnavailableCategory({ data, eventId, categoryId }: { data: WeddingData } & Params) {
  const { isPlanner } = useAccess()
  const { restore, isPending } = useRestoreWithToast()
  const event = data.snapshot.events.find((e) => e.id === eventId)
  const category = data.snapshot.eventCategories.find(
    (c) => c.id === categoryId && c.eventId === eventId,
  )
  const name = data.snapshot.categoryDefinitions.find(
    (d) => d.id === category?.categoryDefinitionId,
  )?.name

  let title = 'Category not found'
  let description = 'It may have been removed, or the link is incorrect.'
  let canRestore = false
  if (category && event?.deletedAt) {
    title = `${event.name} was deleted`
    description = `${name ?? 'This category'} belongs to a deleted event. Restore the event to see it again.`
  } else if (category?.deletedAt) {
    title = `${name ?? 'This category'} was removed`
    description = 'Its activities and payments are kept and come back if you restore it.'
    canRestore = isPlanner
  }

  return (
    <>
      <DetailHeader
        backTo={event && !event.deletedAt ? paths.event(eventId) : paths.home}
        backLabel={event && !event.deletedAt ? event.name : 'Dashboard'}
      />
      <PageContainer>
        <EmptyState
          icon={CircleOff}
          title={title}
          description={description}
          action={
            canRestore && category ? (
              <Button
                disabled={isPending}
                onClick={() => restore({ kind: 'category', id: category.id }, name ?? 'Category')}
              >
                <RotateCcw data-icon="inline-start" />
                Restore category
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link
                  viewTransition
                  to={event && !event.deletedAt ? paths.event(eventId) : paths.home}
                >
                  Go back
                </Link>
              </Button>
            )
          }
          className="my-8"
        />
      </PageContainer>
    </>
  )
}

function CategoryDetails({ data, eventId, categoryId }: { data: WeddingData } & Params) {
  const { isPlanner } = useAccess()
  const { shares, format } = useAmountFormat()
  const navigate = useNavigate()
  const deleteWithUndo = useDeleteWithUndo()
  const [editing, setEditing] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  // Only active categories of active events have a summary.
  const summary = data.budget.categories.get(categoryId)
  const category = data.active.eventCategories.find(
    (c) => c.id === categoryId && c.eventId === eventId,
  )
  const event = data.active.events.find((e) => e.id === eventId)
  const definition = data.active.categoryDefinitions.find(
    (d) => d.id === category?.categoryDefinitionId,
  )
  if (!summary || !category || !event || !definition) {
    return <UnavailableCategory data={data} eventId={eventId} categoryId={categoryId} />
  }

  const otherEvents = otherEventsUsing(data.active, definition.id, event.id)
  const manual = data.snapshot.wedding.budgetMode === 'manual'

  return (
    <>
      <DetailHeader
        backTo={paths.event(event.id)}
        backLabel={event.name}
        title={definition.name}
        actions={
          isPlanner && (
            <ItemActionsMenu
              label="Category actions"
              editLabel="Edit category"
              deleteLabel={`Remove from ${event.name}`}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingRemove(true)}
            />
          )
        }
      />
      <PageContainer>
        <section className="pt-8">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">{event.name}</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">{definition.name}</h1>
        </section>

        <section
          aria-label="Category budget"
          className="mt-8 rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
        >
          <BudgetFigures summary={summary} size="lg" />
          <p className="mt-3 text-xs text-muted-foreground">
            {manual
              ? `Budget set manually for this category. Its activities add up to ${format(summary.childBudgetsCents)}${shares ? ' of the total' : ''}.`
              : 'Budget calculated from this category’s activities.'}
          </p>
        </section>

        {otherEvents.length > 0 && (
          <section className="mt-6" aria-labelledby="shared-heading">
            <h2
              id="shared-heading"
              className="mb-2 inline-flex items-center gap-2 font-sans text-sm font-medium text-muted-foreground"
            >
              <Share2 className="size-4 text-gold" aria-hidden="true" />
              Also used in
            </h2>
            <ul className="flex flex-wrap gap-2">
              {otherEvents.map(({ event: other, eventCategoryId }) => (
                <li key={eventCategoryId}>
                  <Link
                    viewTransition
                    to={paths.category(other.id, eventCategoryId)}
                    className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {other.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ActivitiesSection data={data} eventId={event.id} eventCategoryId={category.id} />

        {isPlanner && (
          <>
            <EditCategorySheet
              open={editing}
              onOpenChange={setEditing}
              wedding={data.snapshot.wedding}
              category={category}
              definition={definition}
              sharedWith={otherEvents.length}
            />
            <ConfirmDialog
              open={confirmingRemove}
              onOpenChange={setConfirmingRemove}
              title={`Remove ${definition.name} from ${event.name}?`}
              description={`Its activities and payments will be hidden too, and it stays available to other events. You can restore it from Recently Deleted.`}
              confirmLabel="Remove category"
              destructive
              onConfirm={() => {
                navigate(paths.event(event.id), { viewTransition: true })
                deleteWithUndo({ kind: 'category', id: category.id }, definition.name)
              }}
            />
          </>
        )}
      </PageContainer>
    </>
  )
}

export function CategoryPage() {
  const { eventId = '', categoryId = '' } = useParams()
  return (
    <WeddingDataBoundary
      fallbackHeader={<DetailHeader backTo={paths.event(eventId)} backLabel="Event" />}
    >
      {(data) => <CategoryDetails data={data} eventId={eventId} categoryId={categoryId} />}
    </WeddingDataBoundary>
  )
}
