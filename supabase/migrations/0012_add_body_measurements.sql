-- Phase 8: historical body-weight tracking. This is a purely additive historical record, kept
-- deliberately separate from profiles.weight_kg (the current-attribute field used by onboarding
-- and the AI-plan prompt, which is left completely untouched and never synced from this table).
--
-- One row per user per date (same shape as nutrition_logs) — editing a date's entry updates that
-- row in place via upsert; entries for different dates are fully independent rows, so editing or
-- deleting one date never affects another.
create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date),
  constraint body_measurements_weight_positive check (weight_kg > 0)
);

alter table body_measurements enable row level security;

create policy "body_measurements own" on body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
