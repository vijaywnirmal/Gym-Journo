-- Phase 5: reusable workout templates. A template is a standalone, named list of exercises
-- (with optional target sets/reps) that a user can copy into a dated workout_plans row.
-- Instantiating a template is an application-level copy, not a live reference — there is no FK
-- from workout_plans/planned_exercises back to a template, so editing or deleting a template
-- never changes an already-instantiated plan or any workout log.
create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null default 0,
  target_sets int,
  target_reps int
);

alter table workout_templates enable row level security;
alter table template_exercises enable row level security;

create policy "workout_templates own" on workout_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "template_exercises own" on template_exercises
  for all using (
    exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid())
  );
