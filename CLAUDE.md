# Wedonomics — Claude instructions

Mobile-first wedding budget planner for one real wedding ("Akshen & Anjana", slug `main`),
live at https://www.mywedonomics.com. `main` auto-deploys to Vercel, so treat every merge as a release.

**Docs:** `PROGRESS.md` (current state, next task: read when resuming) · `PLAN.md` (product
and architecture, read only the relevant section) · `DEPLOYMENT.md` (hosting, env, Supabase,
rollback: read only for infra work) · `README.md` (setup and scripts).

## Stack

React 19 · TypeScript · Vite 8 · Tailwind v4 · shadcn/ui (Radix, `cn` helper) · Lucide ·
React Router 8 (lazy routes) · TanStack Query 5 · Recharts 3 · sonner · Supabase (Postgres,
Auth, Storage). Node 24 via nvm (`.nvmrc`); prefix shell commands with
`export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"` if `node` is missing.

## Layout

- `src/domain/`: pure business logic (types, money, budget, hierarchy, search, export). No
  React, no Supabase. Unit-tested; put new rules here first.
- `src/data/`: `WeddingRepository` interface, `supabase/SupabaseRepository` + mappers,
  TanStack queries, optimistic `useSnapshotMutation`, soft delete/restore hooks.
- `src/features/<area>/`: feature UI, forms, mutations. `src/pages/`: one component per screen.
- `src/components/`: `ui/` (shadcn, owned), `layout/`, `feedback/`, `forms/`, `budget/`, `auth/`.
- `src/auth/`: AccessProvider (guest/planner, lock, sign-out everywhere), login throttle.
- `supabase/migrations/`: hand-written SQL (schema, RLS, storage). `tests/integration/`:
  security and data tests against the remote DB. `scripts/`: planner setup, sample-data seed.

## Data and security invariants (never break these)

- Hierarchy: Wedding → Events → Categories (event's use of a shared category definition) →
  Activities → Payments. Activities also have links and photos.
- Money is **integer CAD cents** everywhere; parse and format with `src/domain/money.ts`, never
  floats.
- Budget mode is ONE wedding-wide setting. Auto: every level above activities = sum of its
  children. Manual: each level uses its own entered amount. Paid always rolls up from payments.
  Over budget = paid > budget (strictly). Still to pay = max(0, actual − paid), only when the
  actual cost is known.
- Soft delete only (`deleted_at`). Children of a deleted parent are hidden, not modified;
  restoring the parent brings them back. Hard DELETE is revoked for API roles.
- Guests: no password, read-only via publishable key + RLS select. Planner: one Supabase Auth
  user listed in `planners`; writes allowed by RLS `is_planner(wedding_id)`. Hiding buttons is
  UX only; RLS is the enforcement. Never ship the secret key, a password, or service-role access
  to the browser. Only public values go in `VITE_*`.
- Never commit `.env*` files (only `.env.example` / `.env.test.example`).
- Storage: public bucket `wedding-media`, paths `{wedding_id}/...`, planners-only writes; images
  are resized to WebP in the browser before upload.

## Database rules

- One remote Supabase project (no local DB/Docker). Schema changes = new migration file in
  `supabase/migrations/`, then `supabase db push --dry-run`, then **ask the user** before the
  real push. Afterwards run `npm run db:types`.
- Ask before any destructive DB operation (including `npm run seed:dev`, which wipes the real
  wedding's content). This DB is production.

## UI conventions

- Mobile-first; check 375px wide first. Elegant ivory/gold theme; tokens in `src/index.css`
  (`--chart-1`, `--slice-1..7`, `--slice-other`; colours validated for contrast; don't invent new
  ones ad hoc). Display font Cormorant Garamond, body Inter.
- Accessibility: one `h1` per screen, labelled controls, never colour alone for status (icons
  for over budget). Charts are `aria-hidden` with a text legend beside them.
- Planner-only controls render only for planners (`useAccess().isPlanner` / `PlannerOnly`).
- Toasts via sonner; delete actions offer Undo; destructive actions use `ConfirmDialog`.
- Phone testing over LAN http is an insecure context: no `crypto.randomUUID`, clipboard or
  Web Share without fallbacks (use `src/lib/randomId.ts`, `src/lib/download.ts`).

## Commands

- `npm run check`: typecheck, oxlint, Prettier check, Vitest unit tests (run before handing off).
- `npm run build`: production build. `npm run test:db`: integration tests vs remote DB
  (needs `.env.test.local`; self-cleaning; ~1 min; run when touching data/RLS/storage).
- `npm run dev -- --host`: dev server; phone link is `http://$(ipconfig getifaddr en0):5173`.
- `npx prettier --write <files>` after edits (Prettier + tailwind plugin reorders classes).

## Git workflow

- One branch per change (`step/NN-name` or a short descriptive name), from up-to-date `main`.
- Keep changes **uncommitted until the user gives the green light**; then commit, push, open a
  PR with `gh` (short description), merge, and update `main` (`git pull --ff-only origin main`).
- The user says "master"; the branch is `main`.
- The repo is in iCloud Documents. Before checks, look for conflict copies:
  `find . -name "* 2*" -not -path "./node_modules/*" -not -path "./.git/*"`.

## Context and token discipline

- Don't read the whole repo at the start. Start from `PROGRESS.md` when resuming; read only the
  files the task touches; use `grep`/targeted reads (line ranges) instead of whole large files.
- Don't load `PLAN.md` or `DEPLOYMENT.md` in full; read the needed section.
- Don't re-read files already in context. Skip `src/lib/database.types.ts` (generated) and
  `src/components/ui/*` unless editing them.
- Keep command output short (`| tail`, `grep FAIL`); expand only when diagnosing failures.
- Load heavy skills (e.g. `dataviz`) only for actual chart/visual-design work, and suggest
  `/clear` after that task. Avoid screenshots unless visually verifying UI.
- Never trade security, correctness or tests for fewer tokens.

## Working style

- One feature (or tightly related set) at a time. Reuse existing components, hooks and domain
  helpers before adding new ones. Production-quality, tested code: add unit tests in
  `src/domain`/feature `*.test.ts` and integration tests for anything touching RLS.
- For large features, write a short plan first and get approval; record approved decisions in
  `PLAN.md`, not in chat.
- End of a substantial task: update `PROGRESS.md` (current state, not a log); update `PLAN.md`
  only for product/architecture changes, `DEPLOYMENT.md` only for infra changes, this file only
  for permanent conventions. Finish with a short summary of changes, tests and open items, so the
  user can safely `/clear`.
