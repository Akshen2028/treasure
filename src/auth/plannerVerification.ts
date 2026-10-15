import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export type Verification = 'planner' | 'not-planner' | 'unreachable'

/**
 * Asks the server whether the current session belongs to a planner of this wedding.
 *
 * This is a UI decision only: whether to show editing controls. Every write is checked
 * again by the database, so a tampered client gains nothing.
 */
export async function verifyPlanner(): Promise<Verification> {
  const { data, error } = await supabase
    .from('planners')
    .select('wedding_id, weddings!inner(slug)')
    .eq('weddings.slug', env.weddingSlug)
    .limit(1)

  if (error) {
    // An expired or revoked token is an auth failure, not a connectivity problem.
    if (error.code === 'PGRST301' || error.code === '401' || /JWT/i.test(error.message)) {
      return 'not-planner'
    }
    return 'unreachable'
  }
  return data.length > 0 ? 'planner' : 'not-planner'
}
