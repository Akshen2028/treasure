import { supabase } from '@/lib/supabase'

/**
 * - planner: the session plans the wedding `slug`
 * - no-wedding: a valid session that plans nothing yet (a new account; send it to create one)
 * - invalid-session: the token is expired or revoked
 * - unreachable: the server couldn't be asked (e.g. offline)
 */
export type Verification =
  | { kind: 'planner'; slug: string }
  | { kind: 'no-wedding' }
  | { kind: 'invalid-session' }
  | { kind: 'unreachable' }

/**
 * Asks the server which wedding the current session plans (one per account).
 *
 * This is a UI decision only: whether to show editing controls. Every write is checked
 * again by the database, so a tampered client gains nothing.
 */
export async function verifyPlanner(): Promise<Verification> {
  // RLS returns only the caller's own planner rows.
  const { data, error } = await supabase
    .from('planners')
    .select('wedding_id, weddings!inner(slug)')
    .limit(1)

  if (error) {
    // An expired or revoked token is an auth failure, not a connectivity problem.
    if (error.code === 'PGRST301' || error.code === '401' || /JWT/i.test(error.message)) {
      return { kind: 'invalid-session' }
    }
    return { kind: 'unreachable' }
  }
  const slug = data[0]?.weddings.slug
  return slug ? { kind: 'planner', slug } : { kind: 'no-wedding' }
}
