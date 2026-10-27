import { slugify } from '@/domain/slug'

/** Same limit as `create_my_wedding()` and the `weddings.name` column. */
export const WEDDING_NAME_MAX = 200

/** Raw form values, exactly as typed. */
export type CreateWeddingFormValues = { name: string; weddingDate: string }

export type CreateWeddingFormErrors = Partial<Record<keyof CreateWeddingFormValues, string>>

export const emptyCreateWeddingForm: CreateWeddingFormValues = { name: '', weddingDate: '' }

/** Validates and cleans the form. */
export function parseCreateWeddingForm(
  values: CreateWeddingFormValues,
):
  | { ok: true; value: { name: string; weddingDate: string | null } }
  | { ok: false; errors: CreateWeddingFormErrors } {
  const errors: CreateWeddingFormErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Give your wedding a name, like “Alex & Sam”.'
  else if (name.length > WEDDING_NAME_MAX) errors.name = 'Keep the name under 200 characters.'
  if (values.weddingDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.weddingDate)) {
    errors.weddingDate = 'Choose a valid date.'
  }
  if (errors.name || errors.weddingDate) return { ok: false, errors }
  return { ok: true, value: { name, weddingDate: values.weddingDate || null } }
}

/**
 * The address the wedding will most likely get, shown while typing. The database assigns the
 * real one and adds a number if it is taken.
 */
export function previewWeddingPath(name: string): string | null {
  return name.trim() ? `/w/${slugify(name)}` : null
}
