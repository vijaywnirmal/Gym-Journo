-- Checks for migration 0051: exercises know how they're measured; sets can record a duration or a
-- distance; such sets count as performed wherever a day decides whether someone trained; the
-- trainer sees them; and a custom exercise's measure can't change once it has logged sets.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- Library measures.
do $$
begin
  if (select measure from exercises where user_id is null and name = 'Plank' limit 1) is distinct from 'time' then
    raise exception 'Plank should be a timed exercise';
  end if;
  if (select measure from exercises where user_id is null and name = 'Treadmill Run' limit 1) is distinct from 'distance' then
    raise exception 'Treadmill Run should be a distance exercise';
  end if;
  if (select measure from exercises where user_id is null and name = 'Barbell Bench Press' limit 1) is distinct from 'weight_reps' then
    raise exception 'Bench press should stay weight and reps';
  end if;
  if exists (select 1 from exercises where measure not in ('weight_reps', 'time', 'distance')) then
    raise exception 'every exercise should have a valid measure';
  end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d501', 'timed-client@example.test'),
  ('00000000-0000-0000-0000-00000000d502', 'timed-trainer@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000d501', true, 'Cleo', 'UTC'),
  ('00000000-0000-0000-0000-00000000d502', true, 'Tara', 'UTC')
on conflict (id) do update set onboarded = true, timezone = 'UTC';
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000d502', 'Tara');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-00000000d501');
insert into exercises (id, user_id, name, measure) values
  ('00000000-0000-0000-0000-00000000de01', '00000000-0000-0000-0000-00000000d501', 'My Hold', 'time'),
  ('00000000-0000-0000-0000-00000000de02', '00000000-0000-0000-0000-00000000d501', 'My Run', 'distance'),
  ('00000000-0000-0000-0000-00000000de03', '00000000-0000-0000-0000-00000000d501', 'Unused', 'time');

-- The client logs a plank-only day and a run-only day through the app's save function.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d501","role":"authenticated"}', true);

select save_workout_log('2026-10-01', null, null, false, jsonb_build_array(jsonb_build_object(
  'exercise_id', '00000000-0000-0000-0000-00000000de01', 'position', 0,
  'sets', jsonb_build_array(jsonb_build_object('set_number', 1, 'duration_seconds', 60)))));
select save_workout_log('2026-10-02', null, null, false, jsonb_build_array(jsonb_build_object(
  'exercise_id', '00000000-0000-0000-0000-00000000de02', 'position', 0,
  'sets', jsonb_build_array(jsonb_build_object('set_number', 1, 'distance', 5, 'duration_seconds', 1710, 'distance_unit', 'mi')))));
-- An older app's payload (no new keys) still saves as before.
select save_workout_log('2026-10-03', null, null, false, jsonb_build_array(jsonb_build_object(
  'exercise_id', '00000000-0000-0000-0000-00000000de01', 'position', 0,
  'sets', jsonb_build_array(jsonb_build_object('set_number', 1, 'reps', 10, 'weight', 0)))));

do $$
declare
  r record;
begin
  select s.* into r from logged_sets s join logged_exercises le on le.id = s.logged_exercise_id
    join workout_logs l on l.id = le.log_id where l.date = '2026-10-02';
  if r.distance <> 5 or r.duration_seconds <> 1710 or r.distance_unit <> 'mi' then
    raise exception 'distance, time and unit should save, got %', row(r.distance, r.duration_seconds, r.distance_unit);
  end if;
  select s.* into r from logged_sets s join logged_exercises le on le.id = s.logged_exercise_id
    join workout_logs l on l.id = le.log_id where l.date = '2026-10-03';
  if r.duration_seconds is not null or r.distance is not null or r.distance_unit <> 'km' then
    raise exception 'an old payload should save no duration or distance, and km by default';
  end if;

  -- Timed and distance days count as trained.
  if (select count(*) from performed_workout_dates('2026-10-01', '2026-10-03')) <> 3 then
    raise exception 'a timed-only and a distance-only day should both count as trained';
  end if;
end $$;

-- Impossible values are refused.
do $$
begin
  begin
    update logged_sets set duration_seconds = -1 where duration_seconds = 60;
    raise exception 'a negative duration should be refused';
  exception when check_violation then null;
  end;
  begin
    update logged_sets set distance_unit = 'yd' where distance_unit = 'mi';
    raise exception 'an unknown distance unit should be refused';
  exception when check_violation then null;
  end;
end $$;

-- A custom exercise's measure can't change once it has logged sets; an unused one can.
do $$
begin
  begin
    update exercises set measure = 'weight_reps' where id = '00000000-0000-0000-0000-00000000de01';
    raise exception 'changing the measure of an exercise with logged sets should be refused';
  exception when raise_exception then
    if sqlerrm not like '%can''t change%' then raise; end if;
  end;
  update exercises set measure = 'distance' where id = '00000000-0000-0000-0000-00000000de03';
  if (select measure from exercises where id = '00000000-0000-0000-0000-00000000de03') <> 'distance' then
    raise exception 'an unused exercise''s measure should be changeable';
  end if;
end $$;

-- The trainer sees the duration and distance.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d502","role":"authenticated"}', true);
do $$
declare
  v jsonb := client_logs('00000000-0000-0000-0000-00000000d501', '2026-10-01', '2026-10-03');
  v_set jsonb;
begin
  select s into v_set from jsonb_array_elements(v) l, jsonb_array_elements(l -> 'exercises') e,
    jsonb_array_elements(e -> 'sets') s where l ->> 'date' = '2026-10-02';
  if (v_set ->> 'distance')::numeric <> 5 or (v_set ->> 'duration_seconds')::int <> 1710 or v_set ->> 'distance_unit' <> 'mi' then
    raise exception 'the trainer should see distance, time and unit, got %', v_set;
  end if;
end $$;

-- The trainer's client list counts the timed and distance days.
do $$
declare
  r jsonb;
begin
  select to_jsonb(o) into r from trainer_client_overview() o where o.client_id = '00000000-0000-0000-0000-00000000d501';
  if r is null then raise exception 'the client should be on the trainer''s list'; end if;
  if (r ->> 'last_workout_on') is distinct from '2026-10-03' then
    raise exception 'the last workout should be the latest performed day, got %', r ->> 'last_workout_on';
  end if;
end $$;
select set_config('request.jwt.claims', '', true);
reset role;

rollback;
