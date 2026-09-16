-- One free-text nutrition entry per user per day, used to give the AI planner context
create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meals_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table nutrition_logs enable row level security;

create policy "nutrition_logs own" on nutrition_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
