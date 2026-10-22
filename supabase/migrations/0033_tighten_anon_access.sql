-- Defence in depth for signed-out (anon) requests through the public API.
--
-- These write functions were granted to authenticated but, unlike 0026-0030, never revoked from
-- public/anon (Postgres grants EXECUTE to public by default). Each already refuses anon in its body
-- (auth.uid() is null), so nothing was exploitable; now anon can't call them at all. Signatures that
-- a later migration dropped are skipped.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'save_workout_log(date, uuid, text, boolean, jsonb)',
    'save_workout_plan(date, text, boolean, uuid[], jsonb)',
    'save_workout_template(uuid, text, jsonb)',
    'apply_program(jsonb)',
    'decide_recommendation(uuid, text, numeric, numeric, text, text, jsonb, boolean)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon', fn);
    end if;
  end loop;
end $$;

-- The shared exercise library (and its muscle-group links) was readable without signing in, while
-- muscle_groups already required a session. The app only reads it signed in.
drop policy "exercises readable" on exercises;
create policy "exercises readable" on exercises
  for select to authenticated using (user_id is null or user_id = auth.uid());

drop policy "exercise_muscle_groups readable" on exercise_muscle_groups;
create policy "exercise_muscle_groups readable" on exercise_muscle_groups
  for select to authenticated using (
    exists (select 1 from exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
  );
