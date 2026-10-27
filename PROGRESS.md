# Progress and handoff

_Last updated: 2026-10-27. Keep this short and current; it is not a changelog (PRs are)._

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

- `npm run check`: typecheck, lint, format; 230 unit tests pass (369 at PR C, 2026-10-20; 426 at step 17). `npm run build` passes (entry
  chunk ≈152 kB gzip; Recharts split into the Home chunk).
- `npm run test:db`: 91/91 integration tests pass (134/134 at PR C; 152/152 at step 17) (RLS, sessions, storage, data integrity).
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
4. The planner account (`wonderlustasaj@gmail.com`) still has its old password in Supabase
   (unused by the app since PR F). User chose to keep it for now; to retire it, set a long
   random password via the admin API (Google and email codes are unaffected).
5. Free Supabase plan (accepted): the project pauses after 7 idle days; there are no automatic
   backups.

Done at go-live: env vars set in Vercel Production; Supabase public sign-ups disabled; custom domain connected.

## Known bugs

- None known.

## Tech debt and gaps

- Browser end-to-end and accessibility scripts were written in a temporary scratchpad, not the
  repo, so they are gone after this session. Re-creating them as a committed Playwright suite
  (planner and guest walkthrough, axe audit) would make UI regressions catchable.
- `npm run test:db` sits near Supabase Auth's limit of 30 code verifications per 5 minutes per
  IP (the suite signs in about 25 times). Files sign in only the users they use
  (`createFixture({ signIn })`); a "Request rate limit reached" failure means wait 5 minutes and
  re-run, not raise the production limit.
- No CI: Vercel builds on merge but runs no tests. Consider a GitHub Action running
  `npm run check` (and `test:db` with secrets) on PRs.
- No service worker: installable, but no offline support.
- Single-wedding app: the wedding is chosen by `VITE_WEDDING_SLUG` (multi-wedding planned, PLAN.md
  §13).
- Entry bundle ≈604 kB raw (warning limit 650 in `vite.config.ts`; the bundler moved some React Router code into it at step 11, first-load JS unchanged at ≈219 kB gzip).
- The repo lives in iCloud-synced Documents (risk of `file 2.ext` conflict copies).

## Next recommended task

Open the app to other couples (PLAN.md §13). **Phase 1 is done**: guests read only through
`guest_view()`, tables are planner-only, photos are private with signed URLs (`media` Edge
Function). Your wedding (slug `main`) is Public, amounts mode; visibility/share-link/percentage
settings have no UI yet (Phase 3).

**Phase 2 (sign-in), done so far:** step 10 `create_my_wedding()` (PR C, migration pushed);
Google sign-in (PR D; Google Cloud project `mywedonomics`, consent screen in Testing); email
6-digit code sign-in with a Cloudflare Turnstile bot check (PR E, #28; Resend SMTP from
`no-reply@mywedonomics.com`, code-only email template, Supabase captcha on since 2026-10-22).
**PR F (branch `phase2/retire-password`)** removes the password login, Change password, the
login throttle, `VITE_PLANNER_EMAIL` and `planner:setup`. No move was needed: `main`'s only
planner is `wonderlustasaj@gmail.com`, linked to Google and email. Sign-ups stay disabled, so
only that account can sign in. LAN phone testing can't sign in (Google allowlist and Turnstile
reject IP hosts).

**Phase 3 step 13 (branch `phase3/wedding-routes`)**: every screen lives under `/w/:slug/...`;
old URLs redirect to `/w/main/...`; `VITE_WEDDING_SLUG` is gone (delete it in Vercel after the
merge; the seed script uses `SEED_SLUG`, default `main`). See PLAN.md §13 step 13.

**Phase 2 step 11 (branch `phase2/first-run`)**: a signed-in account with no wedding is kept
signed in as `new-account` (no longer signed out) and sent to `/create` ("Create your wedding":
name, optional date, Terms/Privacy consent; calls `create_my_wedding`, then opens
`/w/<slug>/home`). Draft Terms and Privacy at `/terms` and `/privacy` (operator Akshen Jasikumar,
Ontario; contact akshen.jasikumar@gmail.com; `src/features/legal/`), also shown in a sheet from
the create screen. Unreachable in production until sign-ups open (they stay disabled).

**Phase 3 step 14 (branch `phase3/landing-page`)**: `/` is the landing page (search Public
weddings and open one as a guest; Google / email sign-in; "My wedding" for planners). It no
longer redirects returning visitors; a fresh sign-in there goes to the planner's wedding, and a
shared link (`?next=`) offers "View this wedding". Settings has "Find another wedding".

**Phase 3 step 15 (branch `phase3/settings`)**: Settings has Sharing (Public/Private, guest
amounts vs percentages, Copy/Reset share link), Web address (slug change; migration
`20261027120000_editable_wedding_slug.sql`), and Terms/Privacy rows. See PLAN.md §13 step 15.

**Phase 3 step 16 (branch `phase3/delete-account`)**: Settings → "Danger zone" → "Delete
wedding and account" (type the web address to confirm). Edge Function `delete-account`
removes photos, the wedding (rows cascade) and the auth user. Terms/Privacy now point to it.
Deploy the function separately (`supabase functions deploy delete-account`). See PLAN.md §13
step 16. Phase 3 is complete with this.

**Phase 4 step 17 (branch `phase4/ai-limit`)**: 30 assistant questions per wedding per day
(Toronto day), counted server-side in `chat` (`use_ai_question`, service role only; 429 at
the limit); the chat shows "N of 30 questions left today". Migration
`20261027140000_ai_usage.sql` pushed and `chat` redeployed on 2026-10-27, ahead of the merge.
Decided 2026-10-27: no separate Anthropic workspace for now; the existing key and its $5
prepaid credit are the spending cap (no top-ups). Revisit before sign-ups open.

**Next: Phase 4, step 18** (record/photo caps per wedding, name/slug limits, slug
blocklist; PLAN.md §13). The key rotation and Supabase Pro upgrade are deferred to the launch
checklist (Phase 5), before public sign-ups are enabled.

## Unresolved decisions

- Whether to clear the sample data now or keep it while demoing.
- Whether to add offline support or CI (not yet requested).
