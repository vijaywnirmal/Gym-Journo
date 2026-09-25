-- M9: schedule a multi-week program in one call.
--
-- p_plans is an array of {date, title, muscle_group_ids: uuid[], exercises: [{exercise_id,
-- position, target_sets, target_reps}]}. One plpgsql call is one transaction: either every new
-- plan is created or none is. Dates that already have a plan for this user are skipped, never
-- overwritten — the person's existing schedule always wins. Returns how many plans were created.
--
-- security invoker: runs as the caller, so the existing RLS policies still apply.
create or replace function apply_program(p_plans jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan jsonb;
  v_plan_id uuid;
  v_exercise jsonb;
  v_created integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_array_length(coalesce(p_plans, '[]'::jsonb)) > 200 then
    raise exception 'Too many plans';
  end if;

  for v_plan in select * from jsonb_array_elements(coalesce(p_plans, '[]'::jsonb))
  loop
    insert into workout_plans (user_id, date, title, is_rest_day)
    values (v_user_id, (v_plan ->> 'date')::date, v_plan ->> 'title', false)
    on conflict (user_id, date) do nothing
    returning id into v_plan_id;

    continue when v_plan_id is null;
    v_created := v_created + 1;

    insert into workout_plan_muscle_groups (plan_id, muscle_group_id)
    select v_plan_id, mg_id::uuid
    from jsonb_array_elements_text(coalesce(v_plan -> 'muscle_group_ids', '[]'::jsonb)) as mg_id
    on conflict do nothing;

    for v_exercise in select * from jsonb_array_elements(coalesce(v_plan -> 'exercises', '[]'::jsonb))
    loop
      insert into planned_exercises (plan_id, exercise_id, position, target_sets, target_reps)
      values (
        v_plan_id,
        (v_exercise ->> 'exercise_id')::uuid,
        (v_exercise ->> 'position')::int,
        nullif(v_exercise ->> 'target_sets', '')::int,
        nullif(v_exercise ->> 'target_reps', '')::int
      );
    end loop;
  end loop;

  return v_created;
end;
$$;

grant execute on function apply_program(jsonb) to authenticated;
