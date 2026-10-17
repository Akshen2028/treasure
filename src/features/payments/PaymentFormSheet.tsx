import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ActivitySummary } from '@/domain/budget'
import { todayIso } from '@/domain/dates'
import { formatCad, parseCadInput } from '@/domain/money'
import type { Id, Payment } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { useCreatePayment, useUpdatePayment } from './mutations'
import {
  type PaymentFormErrors,
  type PaymentFormValues,
  newPaymentForm,
  parsePaymentForm,
  paymentToFormValues,
  previewPaymentImpact,
} from './paymentForm'

type PaymentFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  weddingId: Id
  activityId: Id
  activityName: string
  summary: ActivitySummary
  /** The payment to edit; omit to record a new one. */
  payment?: Payment
}

export function PaymentFormSheet({ open, onOpenChange, ...rest }: PaymentFormSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={rest.payment ? 'Edit payment' : 'Add payment'}
      description={rest.payment ? undefined : `An installment towards ${rest.activityName}.`}
    >
      {open && <PaymentForm {...rest} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function PaymentForm({
  weddingId,
  activityId,
  summary,
  payment,
  onDone,
}: Omit<PaymentFormSheetProps, 'open' | 'onOpenChange' | 'activityName'> & {
  onDone: () => void
}) {
  const create = useCreatePayment()
  const update = useUpdatePayment()
  const [values, setValues] = useState<PaymentFormValues>(
    payment ? paymentToFormValues(payment) : newPaymentForm(todayIso()),
  )
  const [errors, setErrors] = useState<PaymentFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  const set = (field: keyof PaymentFormValues, value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // Live preview of what this payment would do; overpaying is allowed but flagged.
  const typedCents = parseCadInput(values.amount)
  const impact =
    typedCents && typedCents > 0
      ? previewPaymentImpact(summary, typedCents, payment?.amountCents ?? 0)
      : null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = parsePaymentForm(values)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setServerError(null)
    try {
      if (payment) await update.mutateAsync({ id: payment.id, patch: parsed.value })
      else await create.mutateAsync({ weddingId, activityId, ...parsed.value })
      toast.success(
        payment ? 'Payment updated' : `${formatCad(parsed.value.amountCents)} payment added`,
      )
      onDone()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Amount" error={errors.amount}>
          <MoneyInput value={values.amount} onChange={(e) => set('amount', e.target.value)} />
        </FormField>
        <FormField label="Date paid" error={errors.paidOn}>
          <Input
            type="date"
            value={values.paidOn}
            onChange={(e) => set('paidOn', e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Note" optional error={errors.note}>
        <Textarea
          value={values.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="e.g. Deposit, e-transfer to vendor"
          rows={2}
          maxLength={1000}
        />
      </FormField>

      {impact && (impact.overBudgetByCents > 0 || impact.overpaidByCents > 0) && (
        <output className="flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            {impact.overpaidByCents > 0 && (
              <p>
                This would pay <strong>{formatCad(impact.overpaidByCents)}</strong> more than the
                actual cost.
              </p>
            )}
            {impact.overBudgetByCents > 0 && (
              <p>
                This would put the activity <strong>{formatCad(impact.overBudgetByCents)}</strong>{' '}
                over budget.
              </p>
            )}
            <p className="text-xs opacity-80">You can still save it.</p>
          </div>
        </output>
      )}

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
          {payment ? 'Save payment' : 'Add payment'}
        </Button>
      </div>
    </form>
  )
}
