import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { paths } from '@/app/paths'
import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Wedding, WeddingEvent } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import {
  type EventFormErrors,
  type EventFormValues,
  emptyEventForm,
  eventToFormValues,
  parseEventForm,
} from './eventForm'
import { useCreateEvent, useUpdateEvent } from './mutations'

type EventFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wedding: Wedding
  /** The event to edit; omit to create a new one. */
  event?: WeddingEvent
}

/** Add or edit an event. */
export function EventFormSheet({ open, onOpenChange, wedding, event }: EventFormSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={event ? 'Edit event' : 'Add event'}
      description={
        event ? undefined : 'A celebration within the wedding, like a Mehndi or Reception.'
      }
    >
      {/* Mounted only while open, so the form starts fresh each time. */}
      {open && <EventForm wedding={wedding} event={event} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function EventForm({
  wedding,
  event,
  onDone,
}: {
  wedding: Wedding
  event?: WeddingEvent
  onDone: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const [values, setValues] = useState<EventFormValues>(
    event ? eventToFormValues(event) : emptyEventForm,
  )
  const [errors, setErrors] = useState<EventFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending
  const manual = wedding.budgetMode === 'manual'

  const set = (field: keyof EventFormValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseEventForm(values, wedding.budgetMode)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setServerError(null)
    try {
      if (event) {
        await update.mutateAsync({ id: event.id, patch: parsed.value })
        toast.success('Event updated')
        onDone()
      } else {
        const created = await create.mutateAsync({ weddingId: wedding.id, ...parsed.value })
        toast.success(`${created.name} added`)
        onDone()
        navigate(paths.event(created.id), { viewTransition: true })
      }
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField label="Event name" error={errors.name}>
        <Input
          value={values.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="e.g. Mehndi"
          maxLength={120}
          autoComplete="off"
          required
        />
      </FormField>

      <FormField label="Date" optional error={errors.eventDate}>
        <Input
          type="date"
          value={values.eventDate}
          onChange={(e) => set('eventDate')(e.target.value)}
        />
      </FormField>

      <FormField label="Location" optional error={errors.location}>
        <Input
          value={values.location}
          onChange={(e) => set('location')(e.target.value)}
          placeholder="e.g. Pearson Convention Centre"
          maxLength={200}
        />
      </FormField>

      <FormField label="Description" optional error={errors.description}>
        <Textarea
          value={values.description}
          onChange={(e) => set('description')(e.target.value)}
          placeholder="Notes about the event, timings, dress code…"
          rows={3}
          maxLength={5000}
        />
      </FormField>

      {manual ? (
        <FormField
          label="Event budget"
          hint="Your wedding uses manual budgets, so set this event’s budget directly."
          error={errors.manualBudget}
        >
          <MoneyInput
            value={values.manualBudget}
            onChange={(e) => set('manualBudget')(e.target.value)}
          />
        </FormField>
      ) : (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          The event budget is calculated automatically from its activities.
        </p>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          {event ? 'Save changes' : 'Add event'}
        </Button>
      </div>
    </form>
  )
}
