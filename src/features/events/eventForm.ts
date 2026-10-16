import { centsToInput, parseCadInput } from '@/domain/money'
import type { BudgetMode, WeddingEvent } from '@/domain/types'

/** Raw form values, exactly as typed. */
export type EventFormValues = {
  name: string
  eventDate: string
  location: string
  description: string
  manualBudget: string
}

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>

/** The cleaned fields the repository receives. */
export type EventFormResult = {
  name: string
  eventDate: string | null
  location: string
  description: string
  /** Only present when the wedding uses manual budgets. */
  manualBudgetCents?: number
}

export const emptyEventForm: EventFormValues = {
  name: '',
  eventDate: '',
  location: '',
  description: '',
  manualBudget: '',
}

export function eventToFormValues(event: WeddingEvent): EventFormValues {
  return {
    name: event.name,
    eventDate: event.eventDate ?? '',
    location: event.location,
    description: event.description,
    manualBudget: event.manualBudgetCents ? centsToInput(event.manualBudgetCents) : '',
  }
}

/** Validates and converts the form. Limits mirror the database constraints. */
export function parseEventForm(
  values: EventFormValues,
  budgetMode: BudgetMode,
): { ok: true; value: EventFormResult } | { ok: false; errors: EventFormErrors } {
  const errors: EventFormErrors = {}
  const name = values.name.trim()
  const location = values.location.trim()
  const description = values.description.trim()

  if (!name) errors.name = 'Give the event a name.'
  else if (name.length > 120) errors.name = 'Keep the name under 120 characters.'

  if (values.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.eventDate)) {
    errors.eventDate = 'Choose a valid date.'
  }
  if (location.length > 200) errors.location = 'Keep the location under 200 characters.'
  if (description.length > 5000) {
    errors.description = 'Keep the description under 5,000 characters.'
  }

  let manualBudgetCents: number | undefined
  if (budgetMode === 'manual') {
    const raw = values.manualBudget.trim()
    const parsed = raw === '' ? 0 : parseCadInput(raw)
    if (parsed === null) errors.manualBudget = 'Enter an amount like 12,500 or 12500.00.'
    else manualBudgetCents = parsed
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name,
      eventDate: values.eventDate || null,
      location,
      description,
      ...(manualBudgetCents !== undefined && { manualBudgetCents }),
    },
  }
}
