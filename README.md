# Wedonomics

A mobile-first wedding budget planner. Plan events, categories, activities and installment payments, and track budget versus paid across the whole wedding.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), React Router, Recharts, Supabase.

## Getting started

Requires Node 22.22+ (`.nvmrc` pins Node 24).

```sh
nvm use
npm install
cp .env.example .env.local   # public Supabase values + planner email
npm run dev
```

## Scripts

| Command                     | What it does                                   |
| --------------------------- | ---------------------------------------------- |
| `npm run dev`               | Start the dev server                           |
| `npm run build`             | Type-check and build for production            |
| `npm run preview`           | Serve the production build locally             |
| `npm run typecheck`         | TypeScript only                                |
| `npm run lint`              | oxlint                                         |
| `npm run format`            | Format with Prettier                           |
| `npm run format:check`      | Verify formatting                              |
| `npm run test`              | Run Vitest once                                |
| `npm run check`             | Typecheck, lint, format check and tests        |
| `npm run test:db`           | Integration tests against Supabase             |
| `npm run db:types`          | Regenerate database TypeScript types           |
| `npm run seed:dev -- --yes` | Replace the wedding's content with sample data |

## Installing on a phone

The app ships a web manifest and icons (`public/manifest.webmanifest`, `public/icons/`), so it can be added to the Home Screen and opens full-screen at the dashboard. Browsers only offer this over HTTPS, so it works once the app is hosted, not over the plain-http LAN address used for testing.

Every screen except Welcome loads on demand, so the first visit downloads only what that screen needs.

## Project layout

```
src/
  app/          router, route paths, root layout
  domain/       pure business logic: types, money, budget math, soft-delete rules (no React, no Supabase)
  components/
    ui/         shadcn primitives (owned, lightly customised)
    layout/     headers and page containers
    brand/      wordmark
    feedback/   empty, loading, error and confirm states
    forms/      responsive sheet, form fields, money input
    budget/     budget figures and spending progress
  data/         repository interface, Supabase implementation, queries and mutations
  features/     feature UI and logic (events, …): cards, forms, mutations
  pages/        one component per screen
  lib/          small shared utilities, generated database types
supabase/
  migrations/   version-controlled schema, access rules and storage
tests/
  integration/  security and data-integrity tests against Supabase
```

## Database

The app uses one linked Supabase project. All schema changes are SQL migrations in
`supabase/migrations/`, applied with `supabase db push` (always `--dry-run` first).
After a migration, run `npm run db:types`.

**Access model:** guests (public key) can only read; planners (accounts listed in the
`planners` table) can insert and update their wedding; nobody can hard-delete through the API.
Deletion is soft (`deleted_at`).

**Planner access:** there are no passwords. Planners sign in with Google or a 6-digit code sent
by email (Supabase Auth, behind a Cloudflare Turnstile bot check); the session stays until the
planner locks the device. A planner is any account listed in `planners` for the wedding. Public
sign-ups are off, so only existing accounts can sign in.

**Sample data:** `npm run seed:dev -- --yes` permanently clears the wedding's events,
categories, activities, payments, photos and custom categories, then adds a sample multi-day
wedding. `--clear-only` clears without adding anything: run it before going live. The wedding
itself, default categories and planner accounts are kept. It targets `main` unless `SEED_SLUG`
names another wedding.

**Integration tests** (`npm run test:db`) need `.env.test.local` (see `.env.test.example`).
They create a temporary test wedding and test users, and remove them afterwards, including
leftovers from crashed runs (weddings with slug `test-*`, users at
`@integration.wedonomics.test`). Never give a real wedding a `test-` slug.

## Deployment

Live at <https://www.mywedonomics.com> (hosted on Vercel), deployed automatically from `main`. See
[DEPLOYMENT.md](DEPLOYMENT.md) for environment variables, domains, Supabase, verification and
rollback.

## Project docs

[PLAN.md](PLAN.md) (product and architecture) · [PROGRESS.md](PROGRESS.md) (current state and
next steps) · [CLAUDE.md](CLAUDE.md) (conventions for AI-assisted development).

Built in staged steps, one branch and PR per step.
