import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RepositoryError } from '@/data/repository'
import type { CategoryDefinition, EventCategory, Wedding } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { manualBudgetInput, parseManualBudget, validateCategoryName } from './categoryLogic'
import { useEditCategory } from './mutations'

type EditCategorySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wedding: Wedding
  category: EventCategory
  definition: CategoryDefinition
  /** Number of other events using the same shared category. */
  sharedWith: number
}

export function EditCategorySheet({ open, onOpenChange, ...rest }: EditCategorySheetProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Edit category">
      {open && <EditCategoryForm {...rest} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function EditCategoryForm({
  wedding,
  category,
  definition,
  sharedWith,
  onDone,
}: Omit<EditCategorySheetProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const edit = useEditCategory()
  const [name, setName] = useState(definition.name)
  const [budget, setBudget] = useState(manualBudgetInput(category.manualBudgetCents))
  const [nameError, setNameError] = useState<string | undefined>()
  const [budgetError, setBudgetError] = useState<string | undefined>()
  const [serverError, setServerError] = useState<string | null>(null)
  const manual = wedding.budgetMode === 'manual'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nameProblem = validateCategoryName(name)
    const parsedBudget = parseManualBudget(budget, wedding.budgetMode)
    setNameError(nameProblem)
    setBudgetError(parsedBudget.ok ? undefined : parsedBudget.error)
    if (nameProblem || !parsedBudget.ok) return

    const renamed = name.trim() !== definition.name
    const budgetChanged =
      parsedBudget.cents !== undefined && parsedBudget.cents !== category.manualBudgetCents
    if (!renamed && !budgetChanged) {
      onDone()
      return
    }

    setServerError(null)
    try {
      await edit.mutateAsync({
        eventCategoryId: category.id,
        definitionId: definition.id,
        ...(renamed && { name: name.trim() }),
        ...(budgetChanged && { manualBudgetCents: parsedBudget.cents }),
      })
      toast.success('Category updated')
      onDone()
    } catch (err) {
      setServerError(
        err instanceof RepositoryError && err.reason === 'conflict'
          ? `A category named "${name.trim()}" already exists.`
          : errorMessage(err),
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField
        label="Name"
        error={nameError}
        hint={
          sharedWith > 0
            ? `Renaming also changes it in ${sharedWith} other event${sharedWith === 1 ? '' : 's'}.`
            : 'Renaming changes it everywhere it is used.'
        }
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="off"
        />
      </FormField>

      {manual && (
        <FormField label="Category budget" error={budgetError}>
          <MoneyInput value={budget} onChange={(e) => setBudget(e.target.value)} />
        </FormField>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={edit.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={edit.isPending}>
          {edit.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
