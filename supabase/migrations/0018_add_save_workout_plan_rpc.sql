-- Adaptive Training / Coach C2 prerequisite: atomic plan writes, mirroring save_workout_log
-- (0010/0011_add_save_workout_log_rpc.sql). The previous write path (upsert workout_plans, delete
-- workout_plan_muscle_groups, delete planned_exercises, insert muscle groups, insert planned
-- exercises) was five separate round trips from the app — a failure partway through could leave a
-- plan saved with no exercises. A single plpgsql function call is implicitly one transaction: any
-- exception aborts and rolls back every effect of the call, so the plan is either fully replaced
-- or left exactly as it was.
--
-- security invoker (the default) means every statement inside still runs as the calling user, so
-- the existing RLS policies on workout_plans/workout_plan_muscle_groups/planned_exercises are
-- unchanged and still enforced — this function does not bypass or duplicate them.
create or replace function save_workout_plan(
  p_date date,
  p_title text,
  p_is_rest_day boolean,
  p_muscle_group_ids uuid[],
  p_exercises jsonb
) returns workout_plans
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan workout_plans;
  v_exercise jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into workout_plans (user_id, date, title, is_rest_day)
  values (v_user_id, p_date, p_title, p_is_rest_day)
  on conflict (user_id, date) do update set
    title = excluded.title,
    is_rest_day = excluded.is_rest_day
  returning * into v_plan;

  delete from workout_plan_muscle_groups where plan_id = v_plan.id;
  delete from planned_exercises where plan_id = v_plan.id;

  insert into workout_plan_muscle_groups (plan_id, muscle_group_id)
  select v_plan.id, mg_id from unnest(coalesce(p_muscle_group_ids, '{}'::uuid[])) as mg_id;

  for v_exercise in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    insert into planned_exercises (
      plan_id, exercise_id, position, target_sets, target_reps, target_weight, target_weight_unit
    )
    values (
      v_plan.id,
      (v_exercise ->> 'exercise_id')::uuid,
      (v_exercise ->> 'position')::int,
      nullif(v_exercise ->> 'target_sets', '')::int,
      nullif(v_exercise ->> 'target_reps', '')::int,
      nullif(v_exercise ->> 'target_weight', '')::numeric,
      coalesce(nullif(v_exercise ->> 'target_weight_unit', ''), 'kg')
    );
  end loop;

  return v_plan;
end;
$$;

grant execute on function save_workout_plan(date, text, boolean, uuid[], jsonb) to authenticated;
