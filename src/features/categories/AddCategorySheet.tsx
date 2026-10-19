import { Check, LoaderCircle, Minus } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { paths } from '@/app/paths'
import { FormField } from '@/components/forms/FormField'
import { MoneyInput } from '@/components/forms/MoneyInput'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDeleteWithUndo } from '@/data/softDelete'
import type { ActiveSnapshot } from '@/domain/hierarchy'
import type { CategoryDefinition, Wedding, WeddingEvent, WeddingSnapshot } from '@/domain/types'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

import {
  deletableDefinitionIds,
  findDefinitionByName,
  libraryForEvent,
  parseManualBudget,
  validateCategoryName,
} from './categoryLogic'
import { useAddCategoryToEvent } from './mutations'

type AddCategorySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wedding: Wedding
  event: WeddingEvent
  /** Full snapshot: deciding what can be deleted must consider deleted events too. */
  snapshot: WeddingSnapshot
  active: ActiveSnapshot
}

export function AddCategorySheet({ open, onOpenChange, ...rest }: AddCategorySheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add category"
      description={`Choose what you're budgeting for at ${rest.event.name}.`}
    >
      {open && <AddCategoryForm {...rest} onDone={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  )
}

function AddCategoryForm({
  wedding,
  event,
  snapshot,
  active,
  onDone,
}: Omit<AddCategorySheetProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const navigate = useNavigate()
  const add = useAddCategoryToEvent()
  const deleteWithUndo = useDeleteWithUndo()
  const library = useMemo(() => libraryForEvent(active, event.id), [active, event.id])
  const deletable = useMemo(() => deletableDefinitionIds(snapshot), [snapshot])
  const [deleting, setDeleting] = useState<CategoryDefinition | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [budget, setBudget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [budgetError, setBudgetError] = useState<string | undefined>()
  const manual = wedding.budgetMode === 'manual'

  // Typing an existing name selects that category instead of creating a duplicate.
  const typedMatch = newName.trim()
    ? findDefinitionByName(active.categoryDefinitions, newName)
    : undefined
  const typedMatchInEvent = typedMatch
    ? library.find((o) => o.definition.id === typedMatch.id)?.inThisEvent
    : false

  function choose(id: string) {
    setSelectedId((current) => (current === id ? null : id))
    setNewName('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const definitionId = selectedId ?? typedMatch?.id
    if (!definitionId) {
      const nameError = validateCategoryName(newName)
      if (nameError) {
        setError(newName.trim() ? nameError : 'Choose a category or type a new one.')
        return
      }
    }
    if (typedMatchInEvent && !selectedId) {
      setError(`${typedMatch?.name} is already in ${event.name}.`)
      return
    }
    const parsedBudget = parseManualBudget(budget, wedding.budgetMode)
    if (!parsedBudget.ok) {
      setBudgetError(parsedBudget.error)
      return
    }

    try {
      const result = await add.mutateAsync({
        weddingId: wedding.id,
        eventId: event.id,
        ...(definitionId ? { definitionId } : { newName: newName.trim() }),
        ...(parsedBudget.cents !== undefined && { manualBudgetCents: parsedBudget.cents }),
      })
      const name =
        result.definition?.name ??
        active.categoryDefinitions.find((d) => d.id === definitionId)?.name ??
        'Category'
      toast.success(`${name} added to ${event.name}`)
      onDone()
      navigate(paths.category(event.id, result.category.id), { viewTransition: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Shared categories</legend>
        <div className="flex flex-wrap gap-2">
          {library.map(({ definition, inThisEvent }) => {
            const selected = selectedId === definition.id
            const canDelete = deletable.has(definition.id)
            return (
              <div key={definition.id} className="relative">
                <button
                  type="button"
                  disabled={inThisEvent}
                  aria-pressed={selected}
                  onClick={() => choose(definition.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-muted',
                    inThisEvent &&
                      'cursor-not-allowed border-dashed bg-transparent text-muted-foreground',
                  )}
                >
                  {(selected || inThisEvent) && <Check className="size-4" aria-hidden="true" />}
                  {definition.name}
                  {inThisEvent && <span className="sr-only">(already in this event)</span>}
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleting(definition)}
                    aria-label={`Delete custom category ${definition.name}`}
                    className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-destructive/30 bg-card text-destructive shadow-soft transition-colors hover:bg-destructive hover:text-white"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Categories are shared across events, so spending can be compared wedding-wide.
          {deletable.size > 0 && ' Custom categories that no event uses can be deleted with −.'}
        </p>
      </fieldset>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        description="It isn’t used by any event, and it will no longer appear in this list. You can restore it from Recently Deleted."
        confirmLabel="Delete category"
        destructive
        onConfirm={() => {
          if (!deleting) return
          if (selectedId === deleting.id) setSelectedId(null)
          deleteWithUndo({ kind: 'definition', id: deleting.id }, deleting.name)
          setDeleting(null)
        }}
      />

      <FormField
        label="Or create a new category"
        optional
        hint={
          typedMatch
            ? typedMatchInEvent
              ? `${typedMatch.name} is already in this event.`
              : `${typedMatch.name} already exists and will be used.`
            : 'It will be available to every event.'
        }
      >
        <Input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value)
            setSelectedId(null)
            setError(null)
          }}
          placeholder="e.g. Mehndi Artist"
          maxLength={60}
          autoComplete="off"
        />
      </FormField>

      {manual && (
        <FormField
          label="Category budget"
          hint="Your wedding uses manual budgets, so set this category's budget directly."
          error={budgetError}
        >
          <MoneyInput
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value)
              setBudgetError(undefined)
            }}
          />
        </FormField>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          Add category
        </Button>
      </div>
    </form>
  )
}
