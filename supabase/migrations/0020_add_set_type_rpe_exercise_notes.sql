-- M4: richer set data.
--   logged_sets.set_type  warmup | working | drop | failure (existing rows become 'working')
--   logged_sets.rpe       rate of perceived exertion, 1–10 in half steps; null = not recorded
--   logged_exercises.notes  free-text note per exercise in a workout
-- Warm-up sets are still performed sets (History shows them) but are left out of progress,
-- volume and personal-record figures in the app.
alter table logged_sets
  add column set_type text not null default 'working',
  add column rpe numeric(3, 1);

alter table logged_sets
  add constraint logged_sets_set_type_valid check (set_type in ('warmup', 'working', 'drop', 'failure')),
  add constraint logged_sets_rpe_valid check (rpe is null or (rpe between 1 and 10 and rpe * 2 = floor(rpe * 2)));

alter table logged_exercises
  add column notes text;

alter table logged_exercises
  add constraint logged_exercises_notes_length check (notes is null or char_length(notes) <= 500);

-- Same function as 0011, now also writing set_type, rpe and the exercise note. Missing keys fall
-- back to the column defaults, so an older client payload still saves.
create or replace function save_workout_log(
  p_date date,
  p_plan_id uuid,
  p_notes text,
  p_completed boolean,
  p_exercises jsonb
) returns workout_logs
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_log workout_logs;
  v_exercise jsonb;
  v_logged_exercise_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from workout_plans wp where wp.id = p_plan_id and wp.user_id = v_user_id
  ) then
    raise exception 'Invalid plan reference';
  end if;

  insert into workout_logs (user_id, date, plan_id, notes, completed_at)
  values (
    v_user_id,
    p_date,
    p_plan_id,
    p_notes,
    case when p_completed then now() else null end
  )
  on conflict (user_id, date) do update set
    plan_id = excluded.plan_id,
    notes = excluded.notes,
    completed_at = excluded.completed_at
  returning * into v_log;

  delete from logged_exercises where log_id = v_log.id;

  for v_exercise in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    insert into logged_exercises (log_id, exercise_id, position, notes)
    values (
      v_log.id,
      (v_exercise ->> 'exercise_id')::uuid,
      (v_exercise ->> 'position')::int,
      nullif(v_exercise ->> 'notes', '')
    )
    returning id into v_logged_exercise_id;

    insert into logged_sets (logged_exercise_id, set_number, reps, weight, weight_unit, set_type, rpe)
    select
      v_logged_exercise_id,
      (s ->> 'set_number')::int,
      nullif(s ->> 'reps', '')::int,
      nullif(s ->> 'weight', '')::numeric,
      coalesce(nullif(s ->> 'weight_unit', ''), 'kg'),
      coalesce(nullif(s ->> 'set_type', ''), 'working'),
      nullif(s ->> 'rpe', '')::numeric
    from jsonb_array_elements(coalesce(v_exercise -> 'sets', '[]'::jsonb)) s;
  end loop;

  return v_log;
end;
$$;
