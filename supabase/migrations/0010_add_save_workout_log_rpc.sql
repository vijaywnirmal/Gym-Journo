-- Phase 6: atomic workout-log persistence.
--
-- The previous write path (upsert workout_logs, delete logged_exercises, insert
-- logged_exercises, insert logged_sets) was four separate round trips from the app — a failure
-- partway through could leave a partially-written workout. A single plpgsql function call is
-- implicitly one transaction: any exception aborts and rolls back every effect of the call, so
-- the workout is either fully replaced or left exactly as it was.
--
-- security invoker (the default) means every statement inside still runs as the calling user,
-- so the existing RLS policies on workout_logs/logged_exercises/logged_sets are unchanged and
-- still enforced — this function does not bypass or duplicate them.
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
  v_plan_id uuid := p_plan_id;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- A plan_id that doesn't belong to this user is dropped rather than rejected outright, so a
  -- stale/foreign id can never attach a log to someone else's plan.
  if v_plan_id is not null and not exists (
    select 1 from workout_plans wp where wp.id = v_plan_id and wp.user_id = v_user_id
  ) then
    v_plan_id := null;
  end if;

  insert into workout_logs (user_id, date, plan_id, notes, completed_at)
  values (
    v_user_id,
    p_date,
    v_plan_id,
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

grant execute on function save_workout_log(date, uuid, text, boolean, jsonb) to authenticated;
