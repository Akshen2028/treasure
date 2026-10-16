import { CalendarDays, CircleOff, Ellipsis, MapPin, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { BudgetFigures } from '@/components/budget/BudgetFigures'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WeddingData } from '@/data/queries'
import { useDeleteWithUndo, useRestoreWithToast } from '@/data/softDelete'
import { formatDate } from '@/domain/dates'
import type { WeddingEvent } from '@/domain/types'
import { EventFormSheet } from '@/features/events/EventFormSheet'

import { ScaffoldPlaceholder } from './ScaffoldPlaceholder'

function EventActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Event actions">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={onEdit} className="py-2.5">
          <Pencil /> Edit event
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} variant="destructive" className="py-2.5">
          <Trash2 /> Delete event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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

function EventDetails({ data, eventId }: { data: WeddingData; eventId: string }) {
  const { isPlanner } = useAccess()
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
                  <Link to={paths.home}>Back to dashboard</Link>
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
            <EventActions
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )
        }
      />
      <PageContainer>
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
              ? 'Budget set manually for this event.'
              : 'Budget calculated from this event’s activities.'}
          </p>
        </section>

        <ScaffoldPlaceholder
          heading=""
          step="step 07"
          description="This event’s categories, with their budgets and spending."
          next={{ to: paths.category(event.id, 'preview'), label: 'Preview category screen' }}
        />

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
                navigate(paths.home)
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
  const { eventId = '' } = useParams()
  return (
    <WeddingDataBoundary
      fallbackHeader={<DetailHeader backTo={paths.home} backLabel="Dashboard" />}
    >
      {(data) => <EventDetails data={data} eventId={eventId} />}
    </WeddingDataBoundary>
  )
}
