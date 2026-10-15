import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { env } from './env'

/**
 * The one browser Supabase client. It uses only the publishable key; all permissions are
 * enforced by the database. A planner session is stored by Supabase Auth and refreshed
 * automatically, so planners stay signed in until they lock the app.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'wedonomics.auth',
  },
})
