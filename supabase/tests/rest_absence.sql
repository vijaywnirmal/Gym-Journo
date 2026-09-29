-- Checks for migration 0029: rest vs absence days and the late-marking flag set by
-- save_workout_plan, against a real database.
--
-- Run against a local Supabase database with every migration applied:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rest_absence.sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a001', 'rest-a@example.test');
-- UTC+14: for this person "today" is at least a day ahead of UTC's for part of every day, so the
-- checks below use dates well clear of the boundary.
insert into profiles (id, onboarded, timezone) values ('00000000-0000-0000-0000-00000000a001', true, 'Pacific/Kiritimati');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

do $$
declare
  today date := person_today();
  plan workout_plans;
begin
  if today <> (now() at time zone 'Pacific/Kiritimati')::date then
    raise exception 'person_today: expected the profile timezone''s date, got %', today;
  end if;

  -- Marked ahead of time: not late.
  plan := save_workout_plan(today + 2, 'Deload', 'rest', null, null);
  if plan.off_kind <> 'rest' or not plan.is_rest_day or plan.off_marked_late then
    raise exception 'future rest day: expected rest, not late, got % / % / %', plan.off_kind, plan.is_rest_day, plan.off_marked_late;
  end if;

  -- Today counts as on time.
  plan := save_workout_plan(today, 'Travel', 'absence', null, null);
  if plan.off_kind <> 'absence' or plan.off_marked_late then
    raise exception 'absence marked today should not be late, got % / %', plan.off_kind, plan.off_marked_late;
  end if;

  -- A past planned workout relabelled as rest is late, and loses its exercises.
  plan := save_workout_plan(
    today - 3, 'Push', null,
    array[(select id from muscle_groups where name = 'Chest')],
    jsonb_build_array(jsonb_build_object('exercise_id', (select id from exercises where user_id is null limit 1), 'position', 0))
  );
  if plan.is_rest_day or plan.off_kind is not null or plan.off_marked_late then
    raise exception 'workout day should have no off_kind and not be late';
  end if;
  plan := save_workout_plan(today - 3, null, 'rest', null, null);
  if not plan.off_marked_late then
    raise exception 'rest marked after the date should be late';
  end if;
  if exists (select 1 from planned_exercises where plan_id = plan.id)
     or exists (select 1 from workout_plan_muscle_groups where plan_id = plan.id) then
    raise exception 'a day off should carry no exercises or muscle groups';
  end if;

  -- Editing just the reason keeps the original flag, both ways.
  plan := save_workout_plan(today - 3, 'Felt off', 'rest', null, null);
  if not plan.off_marked_late then
    raise exception 'editing the reason of a late rest day should keep it late';
  end if;
  plan := save_workout_plan(today + 2, 'Deload week', 'rest', null, null);
  if plan.off_marked_late then
    raise exception 'editing the reason of an on-time rest day should keep it on time';
  end if;

  -- Changing the kind re-evaluates; switching back to a workout clears it.
  plan := save_workout_plan(today - 3, 'Flu', 'absence', null, null);
  if plan.off_kind <> 'absence' or not plan.off_marked_late then
    raise exception 'past day changed to absence should be late';
  end if;
  plan := save_workout_plan(today - 3, 'Push', null, null, null);
  if plan.is_rest_day or plan.off_marked_late then
    raise exception 'switching back to a workout should clear the day off';
  end if;

  -- The pre-0029 signature still works and saves a rest day.
  plan := save_workout_plan(today + 5, 'Old app', true, null, null);
  if plan.off_kind <> 'rest' or not plan.is_rest_day then
    raise exception 'legacy save_workout_plan(p_is_rest_day => true) should save a rest day';
  end if;

  -- Unknown kinds are rejected.
  begin
    perform save_workout_plan(today + 6, null, 'holiday', null, null);
    raise exception 'an unknown day type should be rejected';
  exception when raise_exception then
    if sqlerrm <> 'Invalid day type' then raise; end if;
  end;
end $$;

-- An unrecognised timezone falls back to UTC instead of failing the save.
reset role;
update profiles set timezone = 'Not/AZone' where id = '00000000-0000-0000-0000-00000000a001';
set local role authenticated;
do $$
begin
  if person_today() <> (now() at time zone 'UTC')::date then
    raise exception 'person_today: an invalid timezone should fall back to UTC';
  end if;
end $$;

select 'rest_absence: all checks passed' as result;

rollback;
