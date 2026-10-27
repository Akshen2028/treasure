import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useWeddingPaths } from '@/app/WeddingContext'
import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Activity, Id } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import {
  type ActivityFormErrors,
  type ActivityFormValues,
  activityToFormValues,
  emptyActivityForm,
  parseActivityForm,
} from './activityForm'
import { useCreateActivity, useUpdateActivity } from './mutations'
import { StatusPicker } from './StatusPicker'

type ActivityFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  weddingId: Id
  eventId: Id
  eventCategoryId: Id
  /** The activity to edit; omit to create one. */
  activity?: Activity
}

export function ActivityFormSheet({ open, onOpenChange, ...rest }: ActivityFormSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={rest.activity ? 'Edit activity' : 'Add activity'}
      description={
        rest.activity ? undefined : 'Something to book or buy, like a caterer, florist or DJ.'
      }
    >
      {open && <ActivityForm {...rest} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function ActivityForm({
  weddingId,
  eventId,
  eventCategoryId,
  activity,
  onDone,
}: Omit<ActivityFormSheetProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const paths = useWeddingPaths()
  const navigate = useNavigate()
  const create = useCreateActivity()
  const update = useUpdateActivity()
  const [values, setValues] = useState<ActivityFormValues>(
    activity ? activityToFormValues(activity) : emptyActivityForm,
  )
  const [errors, setErrors] = useState<ActivityFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  const set = <K extends keyof ActivityFormValues>(field: K, value: ActivityFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parseActivityForm(values)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setServerError(null)
    try {
      if (activity) {
        await update.mutateAsync({ id: activity.id, patch: parsed.value })
        toast.success('Activity updated')
        onDone()
      } else {
        const created = await create.mutateAsync({ weddingId, eventCategoryId, ...parsed.value })
        toast.success(`${created.name} added`)
        onDone()
        navigate(paths.activity(eventId, eventCategoryId, created.id), { viewTransition: true })
      }
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField label="Activity name" error={errors.name}>
        <Input
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Florals"
          maxLength={200}
          autoComplete="off"
          required
        />
      </FormField>

      <StatusPicker value={values.status} onChange={(status) => set('status', status)} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Budget" error={errors.budget} hint="What you plan to spend.">
          <MoneyInput value={values.budget} onChange={(e) => set('budget', e.target.value)} />
        </FormField>
        <FormField
          label="Actual cost"
          optional
          error={errors.actualCost}
          hint="Once you know the final price."
        >
          <MoneyInput
            value={values.actualCost}
            onChange={(e) => set('actualCost', e.target.value)}
            placeholder="Not known yet"
          />
        </FormField>
      </div>

      <FormField label="Description" optional error={errors.description}>
        <Textarea
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What it is, the vendor, what’s included…"
          rows={3}
          maxLength={5000}
        />
      </FormField>

      <FormField label="Notes" optional error={errors.notes}>
        <Textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Contacts, deadlines, ideas…"
          rows={3}
          maxLength={10000}
        />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          {activity ? 'Save changes' : 'Add activity'}
        </Button>
      </div>
    </form>
  )
}
