-- Wedonomics core schema.
--
-- Hierarchy: weddings → events → event_categories → activities → payments / images / links.
-- Shared category_definitions belong to a wedding and are reused by event_categories.
--
-- Conventions
-- * Money: bigint integer CAD cents, 0..99,999,999,999 ($999,999,999.99).
-- * Calendar dates: date. Timestamps: timestamptz.
-- * Every row carries wedding_id. Composite foreign keys (parent_id, wedding_id) guarantee a
--   child always belongs to the same wedding as its parent, and let row-level security check
--   permissions with a single lookup.
-- * Soft deletion: deleted_at is null while active. Children of a deleted parent are hidden by
--   the application, not modified, so restoring the parent restores them.
-- * Hard deletes cascade from weddings. Only privileged scripts can hard-delete (see the
--   row-level security migration); the app never does.

-- ---------------------------------------------------------------------------
-- Types and shared helpers
-- ---------------------------------------------------------------------------

create type public.budget_mode as enum ('auto', 'manual');
create type public.activity_status as enum ('idea', 'planned', 'booked', 'completed');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Weddings
-- ---------------------------------------------------------------------------

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  -- Stable identifier the app uses to find its wedding (e.g. 'main').
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  name text not null check (char_length(name) between 1 and 200),
  wedding_date date,
  -- Wedding-wide: auto sums budgets up from activities; manual uses each level's own amount.
  budget_mode public.budget_mode not null default 'auto',
  manual_budget_cents bigint not null default 0
    check (manual_budget_cents between 0 and 99999999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger weddings_set_updated_at
  before update on public.weddings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Planners: which login accounts may edit which wedding
-- ---------------------------------------------------------------------------

create table public.planners (
  user_id uuid not null references auth.users (id) on delete cascade,
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, wedding_id)
);

create index planners_wedding_id_idx on public.planners (wedding_id);

-- ---------------------------------------------------------------------------
-- Shared category definitions
-- ---------------------------------------------------------------------------

create table public.category_definitions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);

-- Custom categories are created once per wedding: no case-insensitive duplicates.
create unique index category_definitions_wedding_name_key
  on public.category_definitions (wedding_id, lower(btrim(name)));

create trigger category_definitions_set_updated_at
  before update on public.category_definitions
  for each row execute function public.set_updated_at();

-- Every new wedding starts with the seven default categories.
create function public.create_default_categories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.category_definitions (wedding_id, name, is_default, sort_order)
  select new.id, d.name, true, d.sort_order
  from (values
    ('Food', 1),
    ('Decor', 2),
    ('Entertainment', 3),
    ('Venue', 4),
    ('Outfits', 5),
    ('Photographer', 6),
    ('Videographer', 7)
  ) as d (name, sort_order);
  return new;
end;
$$;

create trigger weddings_create_default_categories
  after insert on public.weddings
  for each row execute function public.create_default_categories();

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  event_date date,
  location text not null default '' check (char_length(location) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  -- Storage object path inside the wedding-media bucket, scoped to this wedding's folder.
  cover_image_path text check (
    cover_image_path is null
    or (char_length(cover_image_path) <= 512 and cover_image_path like wedding_id::text || '/%')
  ),
  manual_budget_cents bigint not null default 0
    check (manual_budget_cents between 0 and 99999999999),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);

create index events_wedding_id_idx on public.events (wedding_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Event categories: a shared category used within one event
-- ---------------------------------------------------------------------------

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  event_id uuid not null,
  category_definition_id uuid not null,
  manual_budget_cents bigint not null default 0
    check (manual_budget_cents between 0 and 99999999999),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (event_id, wedding_id)
    references public.events (id, wedding_id) on delete cascade,
  foreign key (category_definition_id, wedding_id)
    references public.category_definitions (id, wedding_id) on delete cascade
);

-- A category appears at most once among an event's active categories. This also blocks a
-- restore that would duplicate a category re-added after deletion.
create unique index event_categories_active_unique
  on public.event_categories (event_id, category_definition_id)
  where deleted_at is null;

create index event_categories_wedding_id_idx on public.event_categories (wedding_id);
create index event_categories_category_definition_id_idx
  on public.event_categories (category_definition_id);

create trigger event_categories_set_updated_at
  before update on public.event_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  event_category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  notes text not null default '' check (char_length(notes) <= 10000),
  status public.activity_status not null default 'idea',
  budget_cents bigint not null default 0 check (budget_cents between 0 and 99999999999),
  actual_cost_cents bigint check (actual_cost_cents between 0 and 99999999999),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (event_category_id, wedding_id)
    references public.event_categories (id, wedding_id) on delete cascade
);

create index activities_wedding_id_idx on public.activities (wedding_id);
create index activities_event_category_id_idx on public.activities (event_category_id);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity images (files live in Storage; only references and metadata are stored here)
-- ---------------------------------------------------------------------------

create table public.activity_images (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  activity_id uuid not null,
  storage_path text not null unique
    check (char_length(storage_path) <= 512 and storage_path like wedding_id::text || '/%'),
  thumbnail_path text
    check (
      thumbnail_path is null
      or (char_length(thumbnail_path) <= 512 and thumbnail_path like wedding_id::text || '/%')
    ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (activity_id, wedding_id)
    references public.activities (id, wedding_id) on delete cascade
);

create index activity_images_wedding_id_idx on public.activity_images (wedding_id);
create index activity_images_activity_id_idx on public.activity_images (activity_id);

create trigger activity_images_set_updated_at
  before update on public.activity_images
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity links
-- ---------------------------------------------------------------------------

create table public.activity_links (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  activity_id uuid not null,
  url text not null check (char_length(url) <= 2048 and url ~* '^https?://[^\s]+$'),
  label text not null default '' check (char_length(label) <= 200),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (activity_id, wedding_id)
    references public.activities (id, wedding_id) on delete cascade
);

create index activity_links_wedding_id_idx on public.activity_links (wedding_id);
create index activity_links_activity_id_idx on public.activity_links (activity_id);

create trigger activity_links_set_updated_at
  before update on public.activity_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments (installments)
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  activity_id uuid not null,
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  paid_on date not null,
  note text not null default '' check (char_length(note) <= 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (activity_id, wedding_id)
    references public.activities (id, wedding_id) on delete cascade
);

create index payments_wedding_id_idx on public.payments (wedding_id);
create index payments_activity_id_idx on public.payments (activity_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
