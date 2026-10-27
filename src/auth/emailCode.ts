/** Input rules for signing in with a code sent by email. Pure, so they are unit-tested. */

/** Seconds before another code can be requested (Supabase allows one email per minute). */
export const RESEND_COOLDOWN_SECONDS = 60

/** Trims and lowercases, so the same address always maps to the same account. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

/** A light check that catches typos before sending; the server is the real judge. */
export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Keeps only the digits, so a code pasted as "123 456" or "123-456" still works. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '')
}

/** The code length is a Supabase setting (8 in production; 6 to 10 allowed). */
export function isCompleteCode(code: string): boolean {
  return /^\d{6,10}$/.test(code)
}
