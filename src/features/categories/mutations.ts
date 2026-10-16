import { useSnapshotMutation } from '@/data/queries'
import type { CategoryDefinition, EventCategory, Id } from '@/domain/types'

type AddCategoryInput = {
  weddingId: Id
  eventId: Id
  /** Use an existing shared category… */
  definitionId?: Id
  /** …or create a new shared category with this name first. */
  newName?: string
  manualBudgetCents?: number
}

type AddCategoryResult = { definition?: CategoryDefinition; category: EventCategory }

/** Adds a shared category to an event, creating the shared category first if it is new. */
export function useAddCategoryToEvent() {
  return useSnapshotMutation({
    mutationFn: async (repository, input: AddCategoryInput): Promise<AddCategoryResult> => {
      let definitionId = input.definitionId
      let definition: CategoryDefinition | undefined
      if (!definitionId) {
        if (!input.newName) throw new Error('Choose or name a category')
        definition = await repository.createCategoryDefinition({
          weddingId: input.weddingId,
          name: input.newName,
        })
        definitionId = definition.id
      }
      const category = await repository.createEventCategory({
        weddingId: input.weddingId,
        eventId: input.eventId,
        categoryDefinitionId: definitionId,
        ...(input.manualBudgetCents !== undefined && {
          manualBudgetCents: input.manualBudgetCents,
        }),
      })
      return { definition, category }
    },
    reconcile: (snapshot, { definition, category }) => ({
      ...snapshot,
      categoryDefinitions: definition
        ? [...snapshot.categoryDefinitions, definition]
        : snapshot.categoryDefinitions,
      eventCategories: [...snapshot.eventCategories, category],
    }),
  })
}

type EditCategoryInput = {
  eventCategoryId: Id
  definitionId: Id
  /** New shared name; renames it in every event. */
  name?: string
  manualBudgetCents?: number
}

/** Renames the shared category and/or updates this event's manual budget. */
export function useEditCategory() {
  return useSnapshotMutation({
    mutationFn: async (repository, input: EditCategoryInput) => {
      const definition =
        input.name !== undefined
          ? await repository.renameCategoryDefinition(input.definitionId, input.name)
          : undefined
      const category =
        input.manualBudgetCents !== undefined
          ? await repository.updateEventCategory(input.eventCategoryId, {
              manualBudgetCents: input.manualBudgetCents,
            })
          : undefined
      return { definition, category }
    },
    reconcile: (snapshot, { definition, category }) => ({
      ...snapshot,
      categoryDefinitions: definition
        ? snapshot.categoryDefinitions.map((d) => (d.id === definition.id ? definition : d))
        : snapshot.categoryDefinitions,
      eventCategories: category
        ? snapshot.eventCategories.map((c) => (c.id === category.id ? category : c))
        : snapshot.eventCategories,
    }),
  })
}
