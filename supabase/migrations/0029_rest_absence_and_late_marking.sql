-- Rest vs absence, and whether a day off was marked after the fact.
--
-- A day off used to be one flag (is_rest_day), so a planned recovery day, a sick day and a skipped
-- workout relabelled afterwards all looked the same, and all dropped out of plan adherence. Now:
--   off_kind         'rest' (planned recovery) or 'absence' (sick, travel, injury); set exactly
--                    when is_rest_day is true. Existing days off become 'rest'.
--   off_marked_late  true when the day was marked off after its date had already passed, in the
--                    person's own timezone. Set by save_workout_plan, never by the app, so it
--                    can't be forged; editing only the reason keeps the original value.
-- A missed day (a planned workout in the past with nothing logged) is not stored: the app works it
-- out from the plan and the log, so nobody labels it.

alter table workout_plans
  add column off_kind text check (off_kind in ('rest', 'absence')),
  add column off_marked_late boolean not null default false;

update workout_plans set off_kind = 'rest' where is_rest_day;

alter table workout_plans
  add constraint workout_plans_off_kind_matches check ((off_kind is not null) = is_rest_day);

-- The signed-in person's today, in their profile timezone (UTC when unset or unrecognised).
create function person_today()
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_timezone text;
begin
  select timezone into v_timezone from profiles where id = auth.uid();
  return (now() at time zone coalesce(nullif(v_timezone, ''), 'UTC'))::date;
exception
  when invalid_parameter_value then
    return (now() at time zone 'UTC')::date;
end;
$$;

-- save_workout_plan (0018) with p_off_kind in place of p_is_rest_day: null for a workout day,
-- 'rest' or 'absence' for a day off. Still one transaction, still SECURITY INVOKER.
create function save_workout_plan(
  p_date date,
  p_title text,
  p_off_kind text,
  p_muscle_group_ids uuid[],
  p_exercises jsonb
) returns workout_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing workout_plans;
  v_marked_late boolean;
  v_plan workout_plans;
  v_exercise jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_off_kind is not null and p_off_kind not in ('rest', 'absence') then
    raise exception 'Invalid day type';
  end if;

  select * into v_existing from workout_plans where user_id = v_user_id and date = p_date;
  v_marked_late := case
    when p_off_kind is null then false
    -- Same kind of day off as before (e.g. only the reason changed): keep when it was first marked.
    when v_existing.off_kind is not distinct from p_off_kind then coalesce(v_existing.off_marked_late, false)
    else p_date < person_today()
  end;

  insert into workout_plans (user_id, date, title, is_rest_day, off_kind, off_marked_late)
  values (v_user_id, p_date, p_title, p_off_kind is not null, p_off_kind, v_marked_late)
  on conflict (user_id, date) do update set
    title = excluded.title,
    is_rest_day = excluded.is_rest_day,
    off_kind = excluded.off_kind,
    off_marked_late = excluded.off_marked_late
  returning * into v_plan;

  delete from workout_plan_muscle_groups where plan_id = v_plan.id;
  delete from planned_exercises where plan_id = v_plan.id;

  -- A day off carries no muscle groups or exercises.
  if p_off_kind is null then
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
  end if;

  return v_plan;
end;
$$;

-- The 0018 signature, kept so an app deployed before this migration keeps working: a day off
-- saved through it is a rest day.
create or replace function save_workout_plan(
  p_date date,
  p_title text,
  p_is_rest_day boolean,
  p_muscle_group_ids uuid[],
  p_exercises jsonb
) returns workout_plans
language sql
security invoker
set search_path = public
as $$
  select save_workout_plan(
    p_date,
    p_title,
    case when p_is_rest_day then 'rest' end,
    p_muscle_group_ids,
    p_exercises
  );
$$;

revoke execute on function person_today() from public, anon;
revoke execute on function save_workout_plan(date, text, text, uuid[], jsonb) from public, anon;
grant execute on function person_today() to authenticated;
grant execute on function save_workout_plan(date, text, text, uuid[], jsonb) to authenticated;
