import { RepositoryError } from '@/data/repository'

/** A sentence suitable for showing to the user after a failed action. */
export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return error.message
  return 'Something went wrong. Please try again.'
}
