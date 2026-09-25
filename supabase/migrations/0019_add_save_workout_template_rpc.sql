-- Adapt prerequisite: atomic template writes, mirroring save_workout_plan (0018) and the
-- original save_workout_log (0010/0011). The previous write path (update-or-insert
-- workout_templates, delete template_exercises, insert template_exercises) was three separate,
-- unguarded round trips from the app — a failure between the delete and the insert could leave a
-- template saved with no exercises, silently. A single plpgsql function call is implicitly one
-- transaction: any exception aborts and rolls back every effect of the call, so the template is
-- either fully replaced or left exactly as it was.
--
-- security invoker (the default) means every statement inside still runs as the calling user, so
-- the existing RLS policies on workout_templates/template_exercises are unchanged and still
-- enforced — this function does not bypass or duplicate them.
--
-- Unlike workout_plans (unique on user_id+date) and workout_logs (unique on user_id+date),
-- workout_templates has no natural conflict key to upsert on, so p_template_id null vs. non-null
-- decides insert vs. update, same as the code it replaces. A p_template_id that doesn't belong to
-- this user is rejected outright (mirroring 0011's foreign plan_id rejection) rather than silently
-- updating zero rows and returning a fabricated success.
create or replace function save_workout_template(
  p_template_id uuid,
  p_name text,
  p_exercises jsonb
) returns workout_templates
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_template workout_templates;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_template_id is not null then
    if not exists (
      select 1 from workout_templates t where t.id = p_template_id and t.user_id = v_user_id
    ) then
      raise exception 'Invalid template reference';
    end if;

    update workout_templates set name = p_name
    where id = p_template_id and user_id = v_user_id
    returning * into v_template;
  else
    insert into workout_templates (user_id, name)
    values (v_user_id, p_name)
    returning * into v_template;
  end if;

  delete from template_exercises where template_id = v_template.id;

  insert into template_exercises (
    template_id, exercise_id, position, target_sets, target_reps, target_weight, target_weight_unit
  )
  select
    v_template.id,
    (ex ->> 'exercise_id')::uuid,
    (ex ->> 'position')::int,
    nullif(ex ->> 'target_sets', '')::int,
    nullif(ex ->> 'target_reps', '')::int,
    nullif(ex ->> 'target_weight', '')::numeric,
    coalesce(nullif(ex ->> 'target_weight_unit', ''), 'kg')
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) ex;

  return v_template;
end;
$$;

grant execute on function save_workout_template(uuid, text, jsonb) to authenticated;
