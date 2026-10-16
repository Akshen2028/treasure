import { centsToInput, parseCadInput } from '@/domain/money'
import type { Activity, ActivityStatus } from '@/domain/types'

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  booked: 'Booked',
  completed: 'Completed',
}

/** Raw form values, exactly as typed. */
export type ActivityFormValues = {
  name: string
  status: ActivityStatus
  budget: string
  actualCost: string
  description: string
  notes: string
}

export type ActivityFormErrors = Partial<Record<keyof ActivityFormValues, string>>

export type ActivityFormResult = {
  name: string
  status: ActivityStatus
  budgetCents: number
  /** null when the actual cost isn't known yet. */
  actualCostCents: number | null
  description: string
  notes: string
}

export const emptyActivityForm: ActivityFormValues = {
  name: '',
  status: 'idea',
  budget: '',
  actualCost: '',
  description: '',
  notes: '',
}

export function activityToFormValues(activity: Activity): ActivityFormValues {
  return {
    name: activity.name,
    status: activity.status,
    budget: activity.budgetCents ? centsToInput(activity.budgetCents) : '',
    actualCost: activity.actualCostCents === null ? '' : centsToInput(activity.actualCostCents),
    description: activity.description,
    notes: activity.notes,
  }
}

const AMOUNT_HINT = 'Enter an amount like 1,250 or 1250.00.'

/** Validates and converts the form. Limits mirror the database constraints. */
export function parseActivityForm(
  values: ActivityFormValues,
): { ok: true; value: ActivityFormResult } | { ok: false; errors: ActivityFormErrors } {
  const errors: ActivityFormErrors = {}
  const name = values.name.trim()
  const description = values.description.trim()
  const notes = values.notes.trim()

  if (!name) errors.name = 'Give the activity a name.'
  else if (name.length > 200) errors.name = 'Keep the name under 200 characters.'

  // A blank budget means $0; activity budgets are always entered by hand.
  const budgetCents = values.budget.trim() === '' ? 0 : parseCadInput(values.budget)
  if (budgetCents === null) errors.budget = AMOUNT_HINT

  // A blank actual cost means "not known yet", which is different from $0.
  const actualCostCents = values.actualCost.trim() === '' ? null : parseCadInput(values.actualCost)
  if (values.actualCost.trim() !== '' && actualCostCents === null) errors.actualCost = AMOUNT_HINT

  if (description.length > 5000) errors.description = 'Keep the description under 5,000 characters.'
  if (notes.length > 10000) errors.notes = 'Keep the notes under 10,000 characters.'

  if (Object.keys(errors).length > 0 || budgetCents === null) return { ok: false, errors }
  return {
    ok: true,
    value: { name, status: values.status, budgetCents, actualCostCents, description, notes },
  }
}
