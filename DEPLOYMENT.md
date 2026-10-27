# Deployment and infrastructure

No secret values belong in this file. Public `VITE_*` values live in `.env.local` (gitignored)
and in Vercel.

## Overview

| Piece                    | Where                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend hosting         | Vercel, project `wedonomics` (Hobby), linked to GitHub `Akshen2028/treasure`                                                               |
| Production URLs          | **`https://www.mywedonomics.com`** (canonical; apex redirects 308 to `www`); also `wedonomics.vercel.app`, `treasure-ten-sigma.vercel.app` |
| Backend                  | Supabase project `hqqnfmrzqsiehyunfibn` (Free tier): Postgres + Auth + Storage                                                             |
| Domain registrar and DNS | Cloudflare (`mywedonomics.com`)                                                                                                            |

## Deploy workflow

1. Work on a branch; run `npm run check`, `npm run build` and, if data, RLS or storage changed,
   `npm run test:db`.
2. Open a PR into `main` and merge. **Merging to `main` deploys to production automatically**
   (Vercel builds with `npm run build` and serves `dist/`). Branch pushes get preview deploys, but the `VITE_*` variables are set for Production only, so previews can't reach Supabase unless they are also added to Preview.
3. Verify production (below). Vercel runs no tests; checks happen locally before merge.

`vercel.json` holds:

- SPA rewrite: every path except `/assets/` and `/icons/` → `index.html`, so deep links and
  refreshes work and missing assets still 404.
- Security headers: a CSP allowing only `'self'` plus the Supabase project's https/wss origin
  (inline styles allowed for Radix and Recharts), `frame-ancestors 'none'`, `X-Frame-Options DENY`,
  `nosniff`, a strict referrer policy and a Permissions-Policy. **If the Supabase project
  changes, update its host in the CSP.**
- `Cache-Control: immutable` for `/assets/*` (hashed filenames).

Vercel Firewall (dashboard, set 2026-10-27): Bot Protection in **Log** mode (Challenge can
break link previews in chat apps), AI Bots allowed, BotID not used, Attack Challenge Mode off
(emergency switch). Sign-in and search call Supabase directly, so the firewall only covers the
static site; Supabase rate limits and Turnstile guard the API.

## Environment variables

Set in Vercel → Settings → Environments → Production (and locally in `.env.local`):

| Name                            | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key, safe in the browser |
| `VITE_TURNSTILE_SITE_KEY`       | Cloudflare Turnstile site key (public)      |

Local-only, never on Vercel: `.env.test.local` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
and `SUPABASE_SECRET_KEY` (used by `test:db` and `seed:dev`). Templates:
`.env.example`, `.env.test.example`. Changing a `VITE_*` value requires a redeploy.

## Custom domain

1. Vercel → Domains → add `mywedonomics.com` (Vercel adds `www` and redirects the apex 308 →
   `www.mywedonomics.com`).
2. Cloudflare DNS: add the records Vercel shows. Currently that is a CNAME for `@` and one for
   `www`, both pointing at the project's `<id>.vercel-dns-017.com` target. **Proxy status: DNS
   only (grey cloud).** The orange proxy breaks Vercel's certificate issuance and can cause
   redirect loops, and Vercel already provides CDN and firewall.
3. Wait for green in Vercel (HTTPS is automatic). Then set Supabase → Authentication → URL
   Configuration → Site URL to the canonical domain.
4. Keep Cloudflare **auto-renew** on (registered until 2027-10-17).
5. Users who installed the app from another domain must re-add it to the Home Screen.

## Supabase

- Migrations: `supabase/migrations/*.sql`, hand-written (no Docker, so no `db diff`). Apply with
  `supabase db push --dry-run`, then `supabase db push` **after user approval**; then
  `npm run db:types`. The CLI is linked (`supabase link`) on the developer machine.
- Auth: Google or an 8-digit email code (expires after 600 s); no passwords in the app (since PR F);
  **public sign-ups disabled** (codes are requested with `shouldCreateUser: false`). Site URL =
  production domain. Free tier: no leaked-password protection, no session time-box.
- Email: custom SMTP through Resend (domain `mywedonomics.com`, DNS records in Cloudflare).
  The Magic Link email template sends only `{{ .Token }}` (no link), so sign-in works inside the
  installed app.
- Bot check: Cloudflare Turnstile widget (hostnames: production, Vercel domains, `localhost`).
  Site key in `VITE_TURNSTILE_SITE_KEY`; secret key only in Supabase → Authentication → Attack
  Protection (captcha on). Supabase then requires a token on code requests and password sign-in
  (not on Google or code verification). Code verifications are rate-limited per IP (about 30
  per 5 minutes); one `test:db` run uses most of that, so wait 5 minutes between runs. The CSP allows `https://challenges.cloudflare.com`
  (script and frame). LAN phone testing can't pass the check (IP hosts aren't allowed).
- Rate limits (Authentication → Rate Limits; checked 2026-10-27): 30 emails/h for the project,
  60 s minimum between emails to one address; per IP per 5 minutes: 30 sign-ins, 30 code
  verifications, 150 token refreshes. SMS, anonymous and Web3 sign-in are off. Email codes
  (Providers → Email): 8 digits, expire after 600 s. Keep the email limit within Resend's plan.
  `supabase/config.toml` holds local defaults only; **never `supabase config push`**, it
  would overwrite these.
- Authorization: RLS on every table (`is_planner()` for writes, public `select` of active rows),
  hard DELETE revoked, storage policies by wedding-id path prefix. Test with `npm run test:db`.
- Storage: private bucket `wedding-media` (since 2026-10-20), 10 MB, image types only (enforced
  by the bucket). Photos load through signed URLs; old public URLs may still be served from the
  CDN cache for photos fetched before the switch.
- Edge Function `chat` (`supabase/functions/chat/`): the in-app AI assistant. Deploy with
  `supabase functions deploy chat` **after user approval** (it is live for the real wedding
  immediately); it does not ship with Vercel. Needs the secret `ANTHROPIC_API_KEY`
  (Anthropic Console API key, separate from any Claude Pro plan), set by the user with
  `supabase secrets set ANTHROPIC_API_KEY=...`, never in `.env*` or chat. The gateway JWT check
  is off (`config.toml`); the function verifies the session and `is_planner` itself. Spend is
  capped by the monthly limit in the Anthropic Console. Logs: Supabase dashboard → Edge
  Functions → chat.
- Edge Function `media` (`supabase/functions/media/`): signed photo URLs for guests, after
  the same visibility/share-key check as `guest_view()`. Uses the built-in
  `SUPABASE_SERVICE_ROLE_KEY` (server-side only). Deploy with `supabase functions deploy media`
  **after user approval**; gateway JWT check off. Deployed 2026-10-19.
- Edge Function `delete-account` (`supabase/functions/delete-account/`): Settings → "Delete
  wedding and account". Verifies the session itself (gateway JWT check off), checks the typed
  web address, then with the built-in `SUPABASE_SERVICE_ROLE_KEY` removes the wedding's photos,
  the wedding row (rows cascade) and the auth user. Deploy with
  `supabase functions deploy delete-account` **after user approval**; until it is deployed the
  button fails harmlessly with an error.
- **Free-tier pause:** the project pauses after ~7 days without traffic; resume from the
  dashboard. The app shows an error state while paused.

## Verify production

1. `https://<domain>/` loads; "Continue as Guest" shows the dashboard with data.
2. A deep link such as `/events/<id>` loads (rewrite), and `/manifest.webmanifest` returns 200.
3. `curl -sI https://<domain>/` shows `content-security-policy` and `x-frame-options`.
4. Sign in as planner, make a small edit, undo it; confirm a guest sees edits but no controls.
5. Upload a photo; no CSP errors in the console.

## Backups and recovery

- Data mistakes: everything is soft-deleted, so restore from **Recently Deleted**.
- The free tier has **no automatic backups**. For a manual backup, use Settings → Export for AI
  (JSON), or `supabase db dump` with the CLI. Photos live in Storage and are not in the export.
- Schema is fully reproducible from `supabase/migrations/`.

## Rollback

- Frontend: Vercel → Deployments → pick the last good deployment → **Promote to Production**
  (instant). Then revert the bad PR on GitHub (`git revert -m 1 <merge sha>`) so `main` matches.
- Database: there are no down migrations. Write a new forward migration that undoes the change,
  dry-run, approve, push. Avoid destructive migrations; prefer additive ones.

## Common issues

- **404 on refresh or deep link:** the `vercel.json` rewrite is missing.
- **DEPLOYMENT_NOT_FOUND on a domain:** the domain isn't attached to this project in Vercel.
- **Domain stuck on "Invalid Configuration":** check the DNS records match Vercel exactly and the
  Cloudflare proxy is off; propagation can take up to an hour.
- **Blank page or blocked requests:** a CSP violation (see the browser console). Usually a new
  external origin; add it to `vercel.json` deliberately.
- **App shows "couldn't load" everywhere:** the Supabase project is paused (free tier).
- **Env change not visible:** redeploy; `VITE_*` values are baked in at build time.

## Pending security task

Rotate the Supabase secret key (leaked in a chat on 2026-10-15): create a new secret key in the
dashboard → update `.env.test.local` → delete the old key. It is not used by the deployed app.
