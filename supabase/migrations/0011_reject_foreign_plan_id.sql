-- Phase 6 follow-up: a plan_id that doesn't belong to the caller is now rejected (the whole
-- save fails and rolls back) instead of being silently dropped to null. Silently proceeding
-- made a client bug indistinguishable from an attack and could mask the former; a legitimate
-- caller only ever sends null or their own plan's id (sourced server-side from
-- getPlanForDate, which already scopes by user_id), so this can only ever reject a
-- malicious or corrupted payload.
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
    insert into logged_exercises (log_id, exercise_id, position)
    values (v_log.id, (v_exercise ->> 'exercise_id')::uuid, (v_exercise ->> 'position')::int)
    returning id into v_logged_exercise_id;

    insert into logged_sets (logged_exercise_id, set_number, reps, weight, weight_unit)
    select
      v_logged_exercise_id,
      (s ->> 'set_number')::int,
      nullif(s ->> 'reps', '')::int,
      nullif(s ->> 'weight', '')::numeric,
      coalesce(nullif(s ->> 'weight_unit', ''), 'kg')
    from jsonb_array_elements(coalesce(v_exercise -> 'sets', '[]'::jsonb)) s;
  end loop;

  return v_log;
end;
$$;
