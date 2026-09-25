-- M10 (Adapt): progressive-overload suggestions and the person's decision on each.
--
-- A suggestion is computed by the app from logged sessions (lib/analyze/overload.ts) and is only
-- stored once the person decides. Accepting changes the planned exercise's target weight — and
-- only then; rejecting records the decision and changes nothing. `evidence` holds the exact sets
-- the suggestion was based on, so every past change can be explained.
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Kept (as null) if the plan is later deleted, so the decision history survives.
  planned_exercise_id uuid references planned_exercises(id) on delete set null,
  exercise_id uuid references exercises(id) on delete set null,
  kind text not null check (kind in ('increase', 'deload')),
  current_weight numeric not null check (current_weight >= 0),
  proposed_weight numeric not null check (proposed_weight >= 0),
  weight_unit text not null check (weight_unit in ('kg', 'lb')),
  reason text not null check (char_length(reason) <= 1000),
  evidence jsonb not null,
  status text not null check (status in ('accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index recommendations_user_planned_idx on recommendations (user_id, planned_exercise_id);

alter table recommendations enable row level security;

create policy "Users read own recommendations" on recommendations
  for select using (user_id = auth.uid());
create policy "Users insert own recommendations" on recommendations
  for insert with check (user_id = auth.uid());

-- Records a decision and, if accepted, applies it — in one transaction. The planned exercise must
-- belong to the caller; a second decision on the same planned exercise is refused.
create or replace function decide_recommendation(
  p_planned_exercise_id uuid,
  p_kind text,
  p_current_weight numeric,
  p_proposed_weight numeric,
  p_weight_unit text,
  p_reason text,
  p_evidence jsonb,
  p_accept boolean
) returns recommendations
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise_id uuid;
  v_row recommendations;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select pe.exercise_id into v_exercise_id
  from planned_exercises pe
  join workout_plans p on p.id = pe.plan_id
  where pe.id = p_planned_exercise_id and p.user_id = v_user_id;

  if v_exercise_id is null then
    raise exception 'Invalid planned exercise';
  end if;

  if exists (
    select 1 from recommendations r
    where r.user_id = v_user_id and r.planned_exercise_id = p_planned_exercise_id
  ) then
    raise exception 'Already decided';
  end if;

  insert into recommendations (
    user_id, planned_exercise_id, exercise_id, kind, current_weight, proposed_weight, weight_unit,
    reason, evidence, status
  ) values (
    v_user_id, p_planned_exercise_id, v_exercise_id, p_kind, p_current_weight, p_proposed_weight,
    p_weight_unit, p_reason, p_evidence, case when p_accept then 'accepted' else 'rejected' end
  )
  returning * into v_row;

  if p_accept then
    update planned_exercises
      set target_weight = p_proposed_weight, target_weight_unit = p_weight_unit
      where id = p_planned_exercise_id;
  end if;

  return v_row;
end;
$$;

grant execute on function decide_recommendation(uuid, text, numeric, numeric, text, text, jsonb, boolean) to authenticated;
