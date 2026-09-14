-- Gym Journal & Scheduler schema

create extension if not exists "pgcrypto";

create table muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  equipment text,
  notes text,
  created_at timestamptz not null default now()
);

create table exercise_muscle_groups (
  exercise_id uuid not null references exercises(id) on delete cascade,
  muscle_group_id uuid not null references muscle_groups(id) on delete cascade,
  primary key (exercise_id, muscle_group_id)
);

-- One scheduled plan per user per date
create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table workout_plan_muscle_groups (
  plan_id uuid not null references workout_plans(id) on delete cascade,
  muscle_group_id uuid not null references muscle_groups(id) on delete cascade,
  primary key (plan_id, muscle_group_id)
);

create table planned_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references workout_plans(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null default 0,
  target_sets int,
  target_reps int
);

-- One logged workout per user per date
create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references workout_plans(id) on delete set null,
  date date not null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table logged_exercises (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references workout_logs(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null default 0
);

create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  logged_exercise_id uuid not null references logged_exercises(id) on delete cascade,
  set_number int not null,
  reps int,
  weight numeric,
  weight_unit text not null default 'kg',
  notes text
);

-- Row Level Security
alter table exercises enable row level security;
alter table exercise_muscle_groups enable row level security;
alter table workout_plans enable row level security;
alter table workout_plan_muscle_groups enable row level security;
alter table planned_exercises enable row level security;
alter table workout_logs enable row level security;
alter table logged_exercises enable row level security;
alter table logged_sets enable row level security;
alter table muscle_groups enable row level security;

-- muscle_groups: readable by any authenticated user, not user-editable
create policy "muscle_groups readable" on muscle_groups
  for select using (auth.role() = 'authenticated');

-- exercises: see global (user_id is null) + own; manage only own
create policy "exercises readable" on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy "exercises insert own" on exercises
  for insert with check (user_id = auth.uid());
create policy "exercises update own" on exercises
  for update using (user_id = auth.uid());
create policy "exercises delete own" on exercises
  for delete using (user_id = auth.uid());

-- exercise_muscle_groups: readable if exercise is readable; writable if exercise is own
create policy "exercise_muscle_groups readable" on exercise_muscle_groups
  for select using (
    exists (select 1 from exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );
create policy "exercise_muscle_groups write own" on exercise_muscle_groups
  for all using (
    exists (select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid())
  );

-- workout_plans: own only
create policy "workout_plans own" on workout_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workout_plan_muscle_groups: via plan ownership
create policy "workout_plan_muscle_groups own" on workout_plan_muscle_groups
  for all using (
    exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- planned_exercises: via plan ownership
create policy "planned_exercises own" on planned_exercises
  for all using (
    exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- workout_logs: own only
create policy "workout_logs own" on workout_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- logged_exercises: via log ownership
create policy "logged_exercises own" on logged_exercises
  for all using (
    exists (select 1 from workout_logs l where l.id = log_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_logs l where l.id = log_id and l.user_id = auth.uid())
  );

-- logged_sets: via logged_exercise -> log ownership
create policy "logged_sets own" on logged_sets
  for all using (
    exists (
      select 1 from logged_exercises le
      join workout_logs l on l.id = le.log_id
      where le.id = logged_exercise_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from logged_exercises le
      join workout_logs l on l.id = le.log_id
      where le.id = logged_exercise_id and l.user_id = auth.uid()
    )
  );
