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

## Environment variables

Set in Vercel → Settings → Environments → Production (and locally in `.env.local`):

| Name                            | Purpose                                          |
| ------------------------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`             | Supabase project URL                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key, safe in the browser      |
| `VITE_PLANNER_EMAIL`            | Planner account email (identifier, not a secret) |
| `VITE_WEDDING_SLUG`             | Which wedding to show (`main`)                   |

Local-only, never on Vercel: `.env.test.local` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
and `SUPABASE_SECRET_KEY` (used by `test:db`, `planner:setup`, `seed:dev`). Templates:
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
- Auth: email/password only; **public sign-ups disabled**; one planner account, managed by
  `npm run planner:setup`. Site URL = production domain. Free tier: no leaked-password
  protection, no session time-box.
- Authorization: RLS on every table (`is_planner()` for writes, public `select` of active rows),
  hard DELETE revoked, storage policies by wedding-id path prefix. Test with `npm run test:db`.
- Storage: public bucket `wedding-media`, 10 MB, image types only (enforced by the bucket).
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
