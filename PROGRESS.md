# Progress and handoff

_Last updated: 2026-10-21. Keep this short and current; it is not a changelog (PRs are)._

## Status

- **Live in production** at <https://www.mywedonomics.com> (verified 2026-10-18; the apex
  `mywedonomics.com` redirects 308 to `www`). Also reachable at `wedonomics.vercel.app` and
  `treasure-ten-sigma.vercel.app`. Auto-deploys on every merge to `main`.
- Domain registered at Cloudflare (DNS only, proxy off; auto-renew should be on, expires
  2027-10-17). See `DEPLOYMENT.md`.
- All 16 build steps merged (PRs #1–#16). `main` is clean.
- Since then: the floating AI (sparkle) button opens an in-app chat with Claude Haiku 5.5 about
  the wedding (planners only; PLAN.md §9a). Served by the Supabase Edge Function `chat`, which
  deploys separately from Vercel (`supabase functions deploy chat`, see DEPLOYMENT.md).
- The assistant can draw charts (computed from live data; donut by default) and propose
  edits, which apply only after the planner taps Apply on a review card, with Undo and a View
  button to the changed page (PLAN.md §9a). The deployed `chat` function matches `main`
  (deployed 2026-10-19 from the same code); redeploy it whenever `src/domain/chat*.ts` or
  `supabase/functions/chat/` change.
- Page transitions (View Transitions API, `src/app/pageTransitions.ts`): drilling down slides
  forward, going up slides back, same-level screens cross-fade, the assistant rises/drops like
  a sheet. Browsers without support just fade the page in. Bottom sheets (`ResponsiveSheet`)
  close with a downward swipe (`src/hooks/useSwipeToDismiss.ts`).

## Verification (2026-10-17, at PR #15/#16)

- `npm run check`: typecheck, lint, format; 230 unit tests pass (369 at PR C, 2026-10-20). `npm run build` passes (entry
  chunk ≈152 kB gzip; Recharts split into the Home chunk).
- `npm run test:db`: 91/91 integration tests pass (134/134 at PR C) (RLS, sessions, storage, data integrity).
- Browser checks (ad-hoc Puppeteer scripts, see Tech debt): full planner and guest walkthrough
  17/17; axe accessibility audit clean on 26 phone and desktop screens; production build
  under `vercel.json` headers passed 8/8 with no CSP violations; live site loads as a guest.

## Open items (need the user)

1. **Rotate the Supabase secret key.** It leaked in chat on 2026-10-15 (prefix `sb_secret_fmZM`).
   Create a new key in the dashboard, put it in `.env.test.local`, delete the old one. User
   deferred it; still the top security item.
2. **Sample data is live.** The real wedding still holds seeded sample data. Clear with
   `npm run seed:dev -- --clear-only --yes` only after explicit approval (destructive).
3. Confirm Supabase Auth → Site URL is `https://www.mywedonomics.com` (was the `vercel.app`
   address at go-live).
4. Free Supabase plan (accepted): the project pauses after 7 idle days; there are no automatic
   backups.

Done at go-live: env vars set in Vercel Production; Supabase public sign-ups disabled; custom domain connected.

## Known bugs

- None known.

## Tech debt and gaps

- Browser end-to-end and accessibility scripts were written in a temporary scratchpad, not the
  repo, so they are gone after this session. Re-creating them as a committed Playwright suite
  (planner and guest walkthrough, axe audit) would make UI regressions catchable.
- No CI: Vercel builds on merge but runs no tests. Consider a GitHub Action running
  `npm run check` (and `test:db` with secrets) on PRs.
- No service worker: installable, but no offline support.
- Single-wedding app: the wedding is chosen by `VITE_WEDDING_SLUG` (multi-wedding planned, PLAN.md
  §13).
- Entry bundle ≈530 kB raw (warning limit raised to 600 in `vite.config.ts`).
- The repo lives in iCloud-synced Documents (risk of `file 2.ext` conflict copies).

## Next recommended task

Open the app to other couples (PLAN.md §13). **Phase 1 is done** (PR #24 and the lockdown PR):
guests read only through `guest_view()`, tables are planner-only, photos are private with
signed URLs (`media` Edge Function). Your wedding (slug `main`) is Public, amounts mode. The
visibility/share-link/percentage settings have no UI yet (Phase 3). **Phase 2 in progress:** step 10 is done
(migration `20261020180000_create_my_wedding.sql`, pushed; `src/domain/slug.ts`). Step 8 is
configured (2026-10-21): Google Cloud project `mywedonomics` (consent screen in Testing; test
users only), Supabase Google provider on, Site URL `https://www.mywedonomics.com`, redirect
allowlist www / `wedonomics.vercel.app` / `localhost:5173`. **PR D (branch
`phase2/google-sign-in`)**: "Continue with Google" on Welcome and the planner dialog; PKCE
redirect back to the same page, completed once in `AccessProvider` (`src/auth/oauthCallback.ts`).
Sign-ups stay disabled, so only an existing auth user's Gmail (the planner account's) can sign
in. LAN phone testing can't use Google (not in the allowlist). **PR E (branch `phase2/email-sign-in`)**: "Continue with Email" (6-digit code) on
Welcome and the planner dialog; Cloudflare Turnstile on the email, password and Change password
forms; test sign-in via admin-generated codes. Resend (domain verified, SMTP in Supabase,
sender `no-reply@mywedonomics.com`), code-only email template and Turnstile site key (local and
Vercel) are set up; email sign-in verified locally 2026-10-22. Only existing accounts get codes
(the one real account is the planner's Gmail). **After merge:** turn on captcha in Supabase
(Attack Protection → Turnstile secret), then `npm run test:db` (the bot-check test needs it)
and a live sign-in check. **Next after E: PR F**
(move `main` to your Google account, retire the password login). The key rotation and Supabase Pro upgrade are deferred
to the launch checklist (Phase 5), before public sign-ups are enabled.

## Unresolved decisions

- Whether to clear the sample data now or keep it while demoing.
- Whether to add offline support or CI (not yet requested).
