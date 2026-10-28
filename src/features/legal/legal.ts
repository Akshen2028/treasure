/*
 * Draft Terms and Privacy Policy (PLAN.md §13). Written in plain language for review; they
 * are not legal advice. Update LAST_UPDATED whenever the wording changes.
 */

export const OPERATOR = 'Akshen Jasikumar'
export const CONTACT_EMAIL = 'akshen.jasikumar@gmail.com'
export const LAST_UPDATED = 'October 27, 2026'

export type LegalDocument = 'terms' | 'privacy'

export const legalTitles: Record<LegalDocument, string> = {
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
}
