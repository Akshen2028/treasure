/**
 * Public runtime configuration. Everything here is bundled into the browser, so only
 * non-secret values belong in VITE_* variables. See .env.example.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`)
  }
  return value
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  /**
   * Identifies the shared planner account; the password is checked by Supabase Auth.
   * Optional so guests still work if it is missing; planner sign-in reports it instead.
   */
  plannerEmail: import.meta.env.VITE_PLANNER_EMAIL || null,
  /** Which wedding this app shows. */
  weddingSlug: import.meta.env.VITE_WEDDING_SLUG || 'main',
} as const
