-- Pravaah V2 — Supabase schema (Step 0 contract).
--
-- Every table stores its zod-validated shape (see contract/schemas.ts) as a single `data jsonb`
-- column, plus the handful of scalar columns other tables need to join or filter on — same
-- pattern as the old project's schema.sql (adapt to the shape that already exists rather than
-- inventing a relational model on top of it).
--
-- RLS: the anon/publishable key gets SELECT only, on every table below. There is no INSERT,
-- UPDATE or DELETE policy anywhere in this file, so the anon key can never write — every write
-- goes through a Next.js API route using the service-role key, which bypasses RLS (same pattern
-- as the old project). Fine-grained access (an organiser sees everything, a visitor sees only
-- their own published VisitorPlan) is enforced by those API routes in a later step, not by RLS —
-- Step 0 only sets up the tables and the anon-read/service-write boundary.
--
-- Apply once via the Supabase SQL editor, or `node scripts/apply-schema.mjs`. Safe to re-run:
-- everything is `if not exists` / `create or replace`, and policies are dropped before recreated.

create extension if not exists pgcrypto;

create table if not exists venues (
  id         text primary key,
  name       text not null,
  data       jsonb not null,        -- Venue (contract/schemas.ts)
  created_at timestamptz not null default now()
);

create table if not exists venue_documents (
  id         text primary key,
  venue_id   text not null references venues(id) on delete cascade,
  type       text not null check (type in ('fire_noc', 'occupancy_cert')),
  data       jsonb not null,        -- VenueDocument
  created_at timestamptz not null default now()
);
create index if not exists venue_documents_venue_idx on venue_documents(venue_id);

create table if not exists events (
  id         text primary key,
  venue_id   text not null references venues(id),
  name       text not null,
  date       date not null,
  data       jsonb not null,        -- Event (contract/schemas.ts)
  created_at timestamptz not null default now()
);
create index if not exists events_venue_idx on events(venue_id);

create table if not exists registrations (
  id         text primary key,
  event_id   text not null references events(id) on delete cascade,
  -- no FK to crowd_groups(id): that table is created further down this file, and a forward
  -- reference would fail a fresh apply. Plain nullable column instead — buildGroups.ts writes it.
  group_id   text,
  data       jsonb not null,        -- Registration: { raw, normalized, groupId }
  created_at timestamptz not null default now()
);
create index if not exists registrations_event_idx on registrations(event_id);
create index if not exists registrations_group_idx on registrations(group_id);
alter table registrations add column if not exists group_id text;

create table if not exists crowd_groups (
  id         text primary key,
  event_id   text not null references events(id) on delete cascade,
  data       jsonb not null,        -- CrowdGroup (1:1 engine Cohort)
  created_at timestamptz not null default now()
);
create index if not exists crowd_groups_event_idx on crowd_groups(event_id);

create table if not exists plans (
  id          text primary key,
  event_id    text not null references events(id) on delete cascade,
  status      text not null default 'draft' check (status in ('draft', 'approved', 'published')),
  approved_by text,
  approved_at timestamptz,
  version     integer not null default 0,  -- bumped by publishPlan() on every publish
  data        jsonb not null,       -- Plan.levers (Intervention[])
  created_at  timestamptz not null default now()
);
create index if not exists plans_event_idx on plans(event_id);
alter table plans add column if not exists version integer not null default 0;

create table if not exists orders (
  id         text primary key,
  plan_id    text not null references plans(id) on delete cascade,
  service    text not null check (service in ('hotel', 'travel', 'gate', 'route', 'food')),
  text       text not null,
  status     text not null default 'pending' check (status in ('pending', 'sent', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists orders_plan_idx on orders(plan_id);

create table if not exists visitor_plans (
  id              text primary key,
  event_id        text not null references events(id) on delete cascade,
  registration_id text not null references registrations(id) on delete cascade,
  version         integer not null default 1,
  data            jsonb not null,   -- VisitorPlan: stay/travel/gate/leaveTime/food/language
  created_at      timestamptz not null default now()
);
create index if not exists visitor_plans_event_idx on visitor_plans(event_id);
create index if not exists visitor_plans_registration_idx on visitor_plans(registration_id);

create table if not exists live_reports (
  id         text primary key,
  event_id   text not null references events(id) on delete cascade,
  source     text not null check (source in ('gate_scan', 'staff', 'visitor_location')),
  payload    jsonb not null default '{}'::jsonb,
  time       timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists live_reports_event_idx on live_reports(event_id);

-- Black Box ledger: append-only, hash-chained (hash = SHA-256(prevHash + canonicalJSON(rest))),
-- unchanged math from the old project's lib/ledger.ts — only the scope changed, from one browser
-- session to one event.
create table if not exists ledger_entries (
  event_id   text not null references events(id) on delete cascade,
  seq        integer not null,
  ts         timestamptz not null,
  sim_clock  text not null,
  type       text not null,
  summary    text not null,
  payload    jsonb not null default '{}'::jsonb,
  prev_hash  text not null,
  hash       text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, seq)
);

-- Step 2: one row per simulate() run — the summary app/api/events/[id]/simulate/route.ts returns.
create table if not exists simulation_results (
  id         text primary key,
  event_id   text not null references events(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists simulation_results_event_idx on simulation_results(event_id);

alter table venues          enable row level security;
alter table venue_documents enable row level security;
alter table events          enable row level security;
alter table registrations   enable row level security;
alter table crowd_groups    enable row level security;
alter table plans           enable row level security;
alter table orders          enable row level security;
alter table visitor_plans   enable row level security;
alter table live_reports    enable row level security;
alter table ledger_entries      enable row level security;
alter table simulation_results  enable row level security;

-- plain PostgreSQL CREATE POLICY has no IF NOT EXISTS — drop-then-create is the idempotent form.
drop policy if exists "anon can read venues" on venues;
create policy "anon can read venues" on venues for select using (true);

drop policy if exists "anon can read venue_documents" on venue_documents;
create policy "anon can read venue_documents" on venue_documents for select using (true);

drop policy if exists "anon can read events" on events;
create policy "anon can read events" on events for select using (true);

drop policy if exists "anon can read registrations" on registrations;
create policy "anon can read registrations" on registrations for select using (true);

drop policy if exists "anon can read crowd_groups" on crowd_groups;
create policy "anon can read crowd_groups" on crowd_groups for select using (true);

drop policy if exists "anon can read plans" on plans;
create policy "anon can read plans" on plans for select using (true);

drop policy if exists "anon can read orders" on orders;
create policy "anon can read orders" on orders for select using (true);

drop policy if exists "anon can read visitor_plans" on visitor_plans;
create policy "anon can read visitor_plans" on visitor_plans for select using (true);

drop policy if exists "anon can read live_reports" on live_reports;
create policy "anon can read live_reports" on live_reports for select using (true);

drop policy if exists "anon can read ledger_entries" on ledger_entries;
create policy "anon can read ledger_entries" on ledger_entries for select using (true);

drop policy if exists "anon can read simulation_results" on simulation_results;
create policy "anon can read simulation_results" on simulation_results for select using (true);
