# Wedonomics: product and architecture

The repository is the source of truth; this file records **what exists and why**. Read only
the section you need. Status markers: ✅ implemented · 🟡 partial · 📋 planned or deferred.

## 1. Goals

- One place for a couple to plan a multi-event wedding budget (e.g. Mehndi, Sangeet, Ceremony,
  Reception) and track installment payments against it, in CAD.
- Mobile-first and elegant; fast on a phone; installable to the Home Screen.
- Family and friends can view without a password; only the planners can change anything,
  enforced by the database, not by hidden buttons.
- Nothing is lost by accident: every delete is reversible.

## 2. Domain model ✅

Wedding → Events → Categories → Activities → Payments (+ activity links and photos).

- **Wedding:** name, date (drives a live countdown, to the second), budget mode, manual
  total budget. One wedding per deployment, chosen by `VITE_WEDDING_SLUG` (schema supports more).
- **Event:** name, optional date, location, description, cover photo, manual budget; ordered.
- **Category definitions** are shared across the wedding: 7 defaults (Food, Decor,
  Entertainment, Venue, Outfits, Photographer, Videographer) plus custom ones. An event's
  _category_ is its use of a definition, so spending is comparable wedding-wide. A custom
  definition can be deleted (soft) only when no event uses it; the add-category sheet shows a
  "−" badge on those. Names are unique per wedding (case-insensitive); typing an existing name
  reuses it.
- **Activity:** name, status (Idea / Planned / Booked / Completed), budget (always entered),
  optional actual cost, description, notes, links, photos.
- **Payment:** amount, date paid, note. Installments; any number per activity.

## 3. Budget rules ✅ (`src/domain/budget.ts`)

- All money is integer cents; text ↔ cents never uses floats. Max $999,999,999.99.
- **One wedding-wide mode** (planner toggle in Settings; user decision 2026-10-15, replacing an
  earlier per-level design):
  - _Auto:_ category, event and wedding budgets are the sums of their children, bubbling up
    from activity budgets. Only activity budgets are entered.
  - _Manual:_ every level uses its own entered amount and never changes with its children.
    Switching auto → manual seeds each level with its current calculated total.
- **Paid** always rolls up from active payments, in both modes.
- **Over budget:** paid > budget, strictly; a $0 budget with any payment is over budget.
- **Activity extras:** still to pay = max(0, actual − paid), shown only when the actual cost is
  known; overpaid = paid > actual. Remaining = budget − paid (can go negative).
- Soft-deleted records, and anything under a deleted ancestor, count for nothing.

## 4. Access and security ✅

- **Guest:** "Continue as Guest", no password. Reads with the publishable key; RLS allows
  `select` on active rows. "Entered" is only a remembered UI preference, not a credential.
- **Planner:** one shared Supabase Auth account (email in `VITE_PLANNER_EMAIL`; the password is
  never in the frontend). Rows in `planners` link users to weddings; RLS writes use
  `is_planner(wedding_id)` (security definer). Created or reset only via `npm run planner:setup`
  (terminal, secret key, hidden prompt).
- Sign-in errors don't reveal whether the account exists. A client-side throttle doubles the
  wait after repeated failures (max 5 min); Supabase's server rate limit is the real guard.
- Settings: **Lock** (sign out this device), **Sign out everywhere** (global), **Change
  password** (re-verifies the current one, then signs out other devices).
- Hard DELETE is revoked for API roles; deletes are `deleted_at` updates. Public sign-ups are
  disabled in Supabase.
- Covered by `tests/integration/` (guests can't write, planners of one wedding can't touch
  another, forged tokens rejected, sessions revoked, storage paths enforced).

## 5. Soft delete and recovery ✅ (`src/domain/hierarchy.ts`)

- Each record has its own `deleted_at`. Deleting a parent marks only the parent; children are
  hidden by ancestry, so restoring the parent brings back exactly what was inside it.
- Every delete shows an **Undo** toast. **Recently Deleted** (planner-only, Settings) lists events,
  categories, custom definitions, activities, payments, links and photos, newest first. Items
  hidden under a deleted parent offer "Restore with ⟨parent⟩".
- 📋 No automatic purge of old deleted items.

## 6. Photos ✅

- Activity photo galleries with a full-screen lightbox; one cover photo per event.
- Resized in the browser before upload (orientation fixed, ≤2048 px, WebP or JPEG fallback,
  plus a thumbnail; GIFs kept as-is), because phone originals are 5–15 MB.
- Public bucket `wedding-media` (10 MB, jpeg/png/webp/gif enforced server-side). Paths start
  with the wedding id; only that wedding's planners can write. Public because guests must see
  photos without auth; object names are random UUIDs.

## 7. Dashboard and charts ✅

- Wedding overview: total budget, paid, used %, remaining or over, plus the live countdown.
- Two donut charts, **By event** and **By category** (category totals across events), with a
  Budget/Paid toggle. A phone shows them as a swipe carousel. Up to 7 coloured slices + "Other";
  colours are fixed by budget rank so an item keeps its colour when toggling.
- Tapping a card opens a full breakdown sheet listing every item; tapping a slice highlights it.
  Over-budget items show an icon (never colour alone). The ring is `aria-hidden`; the legend
  carries the information.
- Event cards and category or activity pages show budget-vs-paid progress.

## 8. Search ✅ (`src/domain/search.ts`)

- Global, client-side search across events, categories and activities, including
  descriptions and notes, with highlighted excerpts and breadcrumbs. Instant, because the
  whole wedding snapshot is already in memory. Payments are not searched.

## 9. Export for AI ✅ (`src/domain/export.ts`, `src/pages/AiExportPage.tsx`)

- Markdown (with explanatory preamble for an AI reader) or JSON; amounts in dollars, active
  records only, figures from the same budget logic. Preview, copy, download.
- "Open in ChatGPT / Claude" copies the export, then opens a new chat with a short starter
  prompt. **The wedding data is never put in the URL** (history, logs, length limits).
  "Share file" appears only where the Web Share API can share files.

## 10. PWA and performance 🟡

- ✅ Web manifest, icons (incl. maskable and apple-touch), standalone display, start at
  `/home`. Installable over HTTPS.
- ✅ Every route except Welcome is lazy-loaded; entry ≈152 kB gzip.
- ✅ Per-screen document titles; axe-clean on all screens.
- 📋 No service worker, so no offline mode.

## 11. Architecture decisions

- **Pure domain layer** (`src/domain`): all money, budget, deletion, search and export rules
  are plain functions on a `WeddingSnapshot`, unit-tested without React or Supabase.
- **Whole-wedding snapshot:** one wedding is small, so the app loads it all (paginated) into
  TanStack Query and derives everything client-side. Mutations update it optimistically and
  reconcile with the server. Toast callbacks are mutation-level so they survive unmounts.
- **Repository interface** (`WeddingRepository`) isolates Supabase; errors are mapped to
  typed reasons with friendly messages.
- **RLS as the only enforcement:** UI hiding is convenience. Integration tests run against the
  real project with an isolated, self-cleaning test wedding.
- **Remote DB only:** no local Supabase or Docker; hand-written migrations; dry-run plus user
  approval before every push.
- **Insecure-context safety:** the planner tests on a phone over LAN http, so there are fallbacks
  for `crypto.randomUUID`, clipboard and share.

## 12. Planned or deferred 📋

- Offline support (service worker).
- CI (checks on PRs) and a committed browser e2e/accessibility suite.
- Multi-wedding or multi-planner management UI (schema supports it; not requested).
