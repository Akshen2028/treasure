import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { SegmentedControl } from '@/components/forms/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WeddingData } from '@/data/queries'
import { manualBudgetsFromCalculated } from '@/domain/budget'
import { centsToInput, formatCad, parseCadInput } from '@/domain/money'
import type { BudgetMode } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { useSwitchBudgetMode, useUpdateWedding } from './mutations'

const MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
] as const

/** Wedding name, date and (in manual mode) the overall budget. */
export function WeddingDetailsForm({ data }: { data: WeddingData }) {
  const { wedding } = data.snapshot
  const update = useUpdateWedding()
  const manual = wedding.budgetMode === 'manual'
  const [name, setName] = useState(wedding.name)
  const [date, setDate] = useState(wedding.weddingDate ?? '')
  const [budget, setBudget] = useState(
    wedding.manualBudgetCents ? centsToInput(wedding.manualBudgetCents) : '',
  )
  const [errors, setErrors] = useState<{ name?: string; budget?: string }>({})

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    const budgetCents = budget.trim() === '' ? 0 : parseCadInput(budget)
    const next = {
      name: !trimmed
        ? 'Give the wedding a name.'
        : trimmed.length > 200
          ? 'Keep it under 200 characters.'
          : undefined,
      budget: manual && budgetCents === null ? 'Enter an amount like 75,000.' : undefined,
    }
    setErrors(next)
    if (next.name || next.budget) return
    try {
      await update.mutateAsync({
        id: wedding.id,
        patch: {
          name: trimmed,
          weddingDate: date || null,
          ...(manual && budgetCents !== null && { manualBudgetCents: budgetCents }),
        },
      })
      toast.success('Wedding details saved')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5">
      <FormField label="Wedding name" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </FormField>
      <FormField label="Wedding date" optional hint="Used for the countdown on the dashboard.">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>
      {manual && (
        <FormField
          label="Total wedding budget"
          error={errors.budget}
          hint={`Your events add up to ${formatCad(data.budget.wedding.childBudgetsCents)}.`}
        >
          <MoneyInput value={budget} onChange={(e) => setBudget(e.target.value)} />
        </FormField>
      )}
      <Button type="submit" variant="outline" className="self-start" disabled={update.isPending}>
        {update.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
        Save details
      </Button>
    </form>
  )
}

/** Auto ↔ manual budgets for the whole wedding, with a clear explanation before switching. */
export function BudgetModeSetting({ data }: { data: WeddingData }) {
  const { snapshot } = data
  const current = snapshot.wedding.budgetMode
  const switchMode = useSwitchBudgetMode()
  const [pending, setPending] = useState<BudgetMode | null>(null)
  const seedTotal = manualBudgetsFromCalculated(snapshot).weddingCents

  function confirm() {
    if (!pending) return
    switchMode.mutate(
      { snapshot, mode: pending },
      {
        onSuccess: () =>
          toast.success(
            pending === 'manual' ? 'Switched to manual budgets' : 'Switched to automatic budgets',
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Budget mode</p>
          <p className="text-sm text-muted-foreground">
            {current === 'auto'
              ? 'Budgets add up automatically from each activity.'
              : 'You set each event and category budget yourself.'}
          </p>
        </div>
        <SegmentedControl
          label="Budget mode"
          options={MODES}
          value={current}
          onChange={(mode) => mode !== current && setPending(mode)}
          className="w-44"
        />
      </div>
      {switchMode.isPending && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Switching…
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending === 'manual' ? 'Switch to manual budgets?' : 'Switch to automatic budgets?'}
        description={
          pending === 'manual'
            ? `Every event and category will start at its current calculated amount (${formatCad(seedTotal)} in total), and the wedding budget too. You can then adjust each one. Changing an activity won’t change them after that.`
            : 'Event, category and wedding budgets will be calculated from activities again. Your manual amounts are set aside; switching back to manual later starts again from the calculated totals.'
        }
        confirmLabel={pending === 'manual' ? 'Switch to manual' : 'Switch to automatic'}
        onConfirm={confirm}
      />
    </div>
  )
}
