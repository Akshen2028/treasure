/** Reads integration-test credentials, failing with a clear message if any are missing. */
export function testEnv() {
  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      'Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY. ' +
        'Copy .env.test.example to .env.test.local and fill it in.',
    )
  }
  return { url, publishableKey, secretKey }
}

/** Every test record is marked with these so leftovers can always be found and removed. */
export const TEST_SLUG_PREFIX = 'test-'
export const TEST_EMAIL_DOMAIN = '@integration.wedonomics.test'
