import type { ActivitySummary } from '@/domain/budget'
import { centsToInput, parseCadInput } from '@/domain/money'
import type { Payment } from '@/domain/types'

export type PaymentFormValues = { amount: string; paidOn: string; note: string }
export type PaymentFormErrors = Partial<Record<keyof PaymentFormValues, string>>
export type PaymentFormResult = { amountCents: number; paidOn: string; note: string }

export function newPaymentForm(today: string): PaymentFormValues {
  return { amount: '', paidOn: today, note: '' }
}

export function paymentToFormValues(payment: Payment): PaymentFormValues {
  return { amount: centsToInput(payment.amountCents), paidOn: payment.paidOn, note: payment.note }
}

/** Validates and converts the form. Limits mirror the database constraints. */
export function parsePaymentForm(
  values: PaymentFormValues,
): { ok: true; value: PaymentFormResult } | { ok: false; errors: PaymentFormErrors } {
  const errors: PaymentFormErrors = {}
  const amountCents = parseCadInput(values.amount)
  const note = values.note.trim()

  if (values.amount.trim() === '') errors.amount = 'Enter the amount paid.'
  else if (amountCents === null) errors.amount = 'Enter an amount like 1,250 or 1250.00.'
  else if (amountCents === 0) errors.amount = 'A payment must be more than $0.'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.paidOn)) errors.paidOn = 'Choose the date it was paid.'
  if (note.length > 1000) errors.note = 'Keep the note under 1,000 characters.'

  if (Object.keys(errors).length > 0 || amountCents === null) return { ok: false, errors }
  return { ok: true, value: { amountCents, paidOn: values.paidOn, note } }
}

export type PaymentImpact = {
  /** Total paid after saving this payment. */
  paidAfterCents: number
  /** How far the total would exceed the budget (0 if it wouldn't). */
  overBudgetByCents: number
  /** How far the total would exceed the actual cost (0 if unknown or it wouldn't). */
  overpaidByCents: number
}

/**
 * What saving a payment would do to the activity, for a live warning in the form.
 * When editing, the payment's current amount is replaced rather than added.
 */
export function previewPaymentImpact(
  summary: Pick<ActivitySummary, 'budgetCents' | 'actualCostCents' | 'paidCents'>,
  amountCents: number,
  replacingCents = 0,
): PaymentImpact {
  const paidAfterCents = summary.paidCents - replacingCents + amountCents
  return {
    paidAfterCents,
    overBudgetByCents: Math.max(0, paidAfterCents - summary.budgetCents),
    overpaidByCents:
      summary.actualCostCents === null ? 0 : Math.max(0, paidAfterCents - summary.actualCostCents),
  }
}

/** Newest first: by payment date, then by when it was recorded. */
export function sortPayments(payments: Payment[]): Payment[] {
  return [...payments].sort(
    (a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt),
  )
}
