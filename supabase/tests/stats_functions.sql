-- Checks for the stats functions in migration 0026 (performed_workout_dates, muscle_set_counts)
-- against a real database. They encode the canonical definitions in src/lib/analyze, so this is
-- where those rules are tested now that the counting runs in SQL.
--
-- Run against a local Supabase database with every migration applied:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/stats_functions.sql
-- Everything happens in one transaction that is rolled back, so no data is left behind. A failed
-- check raises an exception naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'stats-a@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'stats-b@example.test');

insert into muscle_groups (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Test Chest'),
  ('00000000-0000-0000-0000-0000000000c2', 'Test Triceps'),
  ('00000000-0000-0000-0000-0000000000c3', 'Test Back');

insert into exercises (id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000e1', null, 'Test Press'), -- Chest + Triceps
  ('00000000-0000-0000-0000-0000000000e2', null, 'Test Row'); -- Back
insert into exercise_muscle_groups (exercise_id, muscle_group_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c3');

-- User A's logs. "Today" for these checks is 2026-09-21.
insert into workout_logs (id, user_id, date, completed_at) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000a001', '2026-09-15', now()), -- performed + completed
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000a001', '2026-09-16', null),  -- performed, never completed
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-00000000a001', '2026-09-17', now()), -- completed, only blank sets
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-00000000a001', '2026-09-18', null),  -- empty log, no exercises
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-00000000a001', '2026-09-19', null),  -- a recorded 0 counts
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-00000000a001', '2026-09-23', null);  -- future
-- User B's log, which A must never see.
insert into workout_logs (id, user_id, date) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000b002', '2026-09-20');

insert into logged_exercises (id, log_id, exercise_id, position) values
  ('00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000e1', 0),
  ('00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000e2', 1),
  ('00000000-0000-0000-0000-000000001021', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000e1', 0),
  ('00000000-0000-0000-0000-000000001031', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000e1', 0),
  ('00000000-0000-0000-0000-000000001051', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-0000000000e2', 0),
  ('00000000-0000-0000-0000-000000001061', '00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-0000000000e1', 0),
  ('00000000-0000-0000-0000-000000002011', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000e1', 0);

insert into logged_sets (logged_exercise_id, set_number, reps, weight, set_type) values
  -- 09-15 press: warm-up (not a hard set), two working sets, one blank placeholder
  ('00000000-0000-0000-0000-000000001011', 1, 10, 40, 'warmup'),
  ('00000000-0000-0000-0000-000000001011', 2, 5, 100, 'working'),
  ('00000000-0000-0000-0000-000000001011', 3, 5, 100, 'working'),
  ('00000000-0000-0000-0000-000000001011', 4, null, null, 'working'),
  -- 09-15 row: a drop set counts as a hard set
  ('00000000-0000-0000-0000-000000001012', 1, 8, 60, 'drop'),
  -- 09-16 press: one working set
  ('00000000-0000-0000-0000-000000001021', 1, 8, 90, 'working'),
  -- 09-17 press: blank planned sets only
  ('00000000-0000-0000-0000-000000001031', 1, null, null, 'working'),
  ('00000000-0000-0000-0000-000000001031', 2, null, null, 'working'),
  -- 09-19 row: reps recorded as 0
  ('00000000-0000-0000-0000-000000001051', 1, 0, null, 'working'),
  -- 09-23 (future) press
  ('00000000-0000-0000-0000-000000001061', 1, 5, 100, 'working'),
  -- user B
  ('00000000-0000-0000-0000-000000002011', 1, 5, 100, 'working');

-- Act as user A, the way PostgREST does for a signed-in request.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

do $$
declare
  got date[];
begin
  select array_agg(date order by date) into got from performed_workout_dates('2026-09-01', '2026-09-21');
  if got is distinct from array['2026-09-15', '2026-09-16', '2026-09-19']::date[] then
    raise exception 'performed_workout_dates: expected 09-15, 09-16, 09-19 (not blank, empty, future or another user''s), got %', got;
  end if;

  select array_agg(date order by date) into got from performed_workout_dates(null, '2026-09-30');
  if got is distinct from array['2026-09-15', '2026-09-16', '2026-09-19', '2026-09-23']::date[] then
    raise exception 'performed_workout_dates: a null p_from should start from the beginning and p_to should bound it, got %', got;
  end if;

  select array_agg(date order by date) into got from performed_workout_dates('2026-09-16', '2026-09-16');
  if got is distinct from array['2026-09-16']::date[] then
    raise exception 'performed_workout_dates: a one-day window should be inclusive at both ends, got %', got;
  end if;

  if (select date from performed_workout_dates(null, '2026-09-21') order by date desc limit 1) <> '2026-09-19' then
    raise exception 'performed_workout_dates: newest workout day up to today should be 09-19';
  end if;
end $$;

do $$
declare
  got text;
begin
  select string_agg(name || '=' || sets, ', ' order by name) into got from muscle_set_counts('2026-09-14', '2026-09-21');
  -- Chest and Triceps: 2 working sets on 09-15 + 1 on 09-16 (warm-up and blank excluded).
  -- Back: 1 drop set on 09-15 + the recorded-0 set on 09-19. Future and user B's sets excluded.
  if got is distinct from 'Test Back=2, Test Chest=3, Test Triceps=3' then
    raise exception 'muscle_set_counts: expected Back=2, Chest=3, Triceps=3, got %', got;
  end if;

  if exists (select 1 from muscle_set_counts('2026-10-01', '2026-10-07')) then
    raise exception 'muscle_set_counts: an empty week should return no rows';
  end if;
end $$;

-- Signed out: auth.uid() is null, so nothing comes back.
select set_config('request.jwt.claims', '', true);
do $$
begin
  if exists (select 1 from performed_workout_dates(null, '2026-09-30'))
     or exists (select 1 from muscle_set_counts('2026-09-01', '2026-09-30')) then
    raise exception 'stats functions must return nothing without a signed-in user';
  end if;
end $$;

select 'stats_functions: all checks passed' as result;

rollback;
