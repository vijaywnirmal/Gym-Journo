-- Stores AI-generated diet/workout plans, and doubles as the per-user rate-limit log
create table ai_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_level text,
  dietary_preference text,
  notes text,
  plan_markdown text not null,
  created_at timestamptz not null default now()
);

alter table ai_plans enable row level security;

create policy "ai_plans own" on ai_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index ai_plans_user_created_idx on ai_plans (user_id, created_at desc);
