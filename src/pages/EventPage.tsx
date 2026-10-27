import { CalendarDays, CircleOff, LayoutGrid, MapPin, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useWeddingPaths } from '@/app/WeddingContext'
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
import { formatDate } from '@/domain/dates'
import type { WeddingEvent } from '@/domain/types'
import { AddCategorySheet } from '@/features/categories/AddCategorySheet'
import { CategoryCard } from '@/features/categories/CategoryCard'
import { activityCount, categoriesForEvent } from '@/features/categories/categoryLogic'
import { EventFormSheet } from '@/features/events/EventFormSheet'
import { EventCover } from '@/features/media/EventCover'

function DeletedEventNotice({ event }: { event: WeddingEvent }) {
  const { isPlanner } = useAccess()
  const { restore, isPending } = useRestoreWithToast()
  return (
    <EmptyState
      icon={CircleOff}
      title={`${event.name} was deleted`}
      description="Its categories and activities are kept and come back if you restore it."
      action={
        isPlanner && (
          <Button
            disabled={isPending}
            onClick={() => restore({ kind: 'event', id: event.id }, event.name)}
          >
            <RotateCcw data-icon="inline-start" />
            Restore event
          </Button>
        )
      }
      className="my-8"
    />
  )
}

function CategoriesSection({ data, event }: { data: WeddingData; event: WeddingEvent }) {
  const paths = useWeddingPaths()
  const { isPlanner } = useAccess()
  const [adding, setAdding] = useState(false)
  const categories = categoriesForEvent(data.active, event.id)

  return (
    <section className="mt-10" aria-labelledby="categories-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="categories-heading" className="text-3xl">
          Categories
        </h2>
        {isPlanner && categories.length > 0 && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add category
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No categories yet"
          description={
            isPlanner
              ? 'Add what you’re budgeting for, like Food, Decor or a Photographer.'
              : 'The planners haven’t added categories to this event yet.'
          }
          action={
            isPlanner && (
              <Button onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                Add a category
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {categories.map(({ category, definition }) => {
            const summary = data.budget.categories.get(category.id)
            return (
              summary && (
                <li key={category.id}>
                  <CategoryCard
                    to={paths.category(event.id, category.id)}
                    name={definition.name}
                    activities={activityCount(data.active, category.id)}
                    summary={summary}
                  />
                </li>
              )
            )
          })}
        </ul>
      )}

      {isPlanner && (
        <AddCategorySheet
          open={adding}
          onOpenChange={setAdding}
          wedding={data.snapshot.wedding}
          event={event}
          snapshot={data.snapshot}
          active={data.active}
        />
      )}
    </section>
  )
}

function EventDetails({ data, eventId }: { data: WeddingData; eventId: string }) {
  const paths = useWeddingPaths()
  const { isPlanner } = useAccess()
  const { shares, format } = useAmountFormat()
  const navigate = useNavigate()
  const deleteWithUndo = useDeleteWithUndo()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const event = data.snapshot.events.find((e) => e.id === eventId)
  const summary = data.budget.events.get(eventId)

  if (!event || event.deletedAt || !summary) {
    return (
      <>
        <DetailHeader backTo={paths.home} backLabel="Dashboard" />
        <PageContainer>
          {event ? (
            <DeletedEventNotice event={event} />
          ) : (
            <EmptyState
              icon={CircleOff}
              title="Event not found"
              description="It may have been removed, or the link is incorrect."
              action={
                <Button asChild variant="outline">
                  <Link viewTransition to={paths.home}>
                    Back to dashboard
                  </Link>
                </Button>
              }
              className="my-8"
            />
          )}
        </PageContainer>
      </>
    )
  }

  const manual = data.snapshot.wedding.budgetMode === 'manual'

  return (
    <>
      <DetailHeader
        backTo={paths.home}
        backLabel="Dashboard"
        title={event.name}
        actions={
          isPlanner && (
            <ItemActionsMenu
              label="Event actions"
              editLabel="Edit event"
              deleteLabel="Delete event"
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )
        }
      />
      <PageContainer>
        <EventCover event={event} isPlanner={isPlanner} />
        <section className="pt-8">
          <h1 className="text-4xl sm:text-5xl">{event.name}</h1>
          <p className="mt-3 flex flex-col gap-1.5 text-muted-foreground sm:flex-row sm:gap-5">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-gold" aria-hidden="true" />
              {event.eventDate ? formatDate(event.eventDate, 'long') : 'Date to be decided'}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-gold" aria-hidden="true" />
                {event.location}
              </span>
            )}
          </p>
          {event.description && (
            <p className="mt-5 leading-relaxed whitespace-pre-line">{event.description}</p>
          )}
        </section>

        <section
          aria-label="Event budget"
          className="mt-8 rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
        >
          <BudgetFigures summary={summary} size="lg" />
          <p className="mt-3 text-xs text-muted-foreground">
            {manual
              ? `Budget set manually for this event. Its categories add up to ${format(summary.childBudgetsCents)}${shares ? ' of the total' : ''}.`
              : 'Budget calculated from this event’s activities.'}
          </p>
        </section>

        <CategoriesSection data={data} event={event} />

        {isPlanner && (
          <>
            <EventFormSheet
              open={editing}
              onOpenChange={setEditing}
              wedding={data.snapshot.wedding}
              event={event}
            />
            <ConfirmDialog
              open={confirmingDelete}
              onOpenChange={setConfirmingDelete}
              title={`Delete ${event.name}?`}
              description="Its categories, activities and payments will be hidden too. You can restore everything from Recently Deleted."
              confirmLabel="Delete event"
              destructive
              onConfirm={() => {
                navigate(paths.home, { viewTransition: true })
                deleteWithUndo({ kind: 'event', id: event.id }, event.name)
              }}
            />
          </>
        )}
      </PageContainer>
    </>
  )
}

export function EventPage() {
  const paths = useWeddingPaths()
  const { eventId = '' } = useParams()
  return (
    <WeddingDataBoundary
      fallbackHeader={<DetailHeader backTo={paths.home} backLabel="Dashboard" />}
    >
      {(data) => <EventDetails data={data} eventId={eventId} />}
    </WeddingDataBoundary>
  )
}
