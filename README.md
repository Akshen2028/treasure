# Wedonomics

A mobile-first wedding budget planner. Plan events, categories, activities and installment payments, and track budget versus paid across the whole wedding.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), React Router, Recharts, Supabase.

## Getting started

Requires Node 22.22+ (`.nvmrc` pins Node 24).

```sh
nvm use
npm install
cp .env.example .env.local   # fill in public Supabase values (from step 04)
npm run dev
```

## Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the dev server                    |
| `npm run build`        | Type-check and build for production     |
| `npm run preview`      | Serve the production build locally      |
| `npm run typecheck`    | TypeScript only                         |
| `npm run lint`         | oxlint                                  |
| `npm run format`       | Format with Prettier                    |
| `npm run format:check` | Verify formatting                       |
| `npm run test`         | Run Vitest once                         |
| `npm run check`        | Typecheck, lint, format check and tests |

## Project layout

```
src/
  app/          router, route paths, root layout
  domain/       pure business logic: types, money, budget math, soft-delete rules (no React, no Supabase)
  components/
    ui/         shadcn primitives (owned, lightly customised)
    layout/     headers and page containers
    brand/      wordmark
    feedback/   empty and error states
  pages/        one component per screen
  lib/          small shared utilities
```

Built in staged steps, one branch and PR per step.
