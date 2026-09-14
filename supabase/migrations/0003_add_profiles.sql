-- One profile row per user, holding personal stats and onboarding status
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  age int,
  height_cm numeric,
  weight_kg numeric,
  sex text,
  goal text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles own" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
