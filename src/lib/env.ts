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
   * Cloudflare Turnstile site key for the bot check on sign-in forms (public by design).
   * Without it no check is shown; Supabase then refuses sign-ins if its captcha is on.
   */
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || null,
} as const
