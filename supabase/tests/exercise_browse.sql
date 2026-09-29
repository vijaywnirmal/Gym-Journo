-- Checks for the exercise browsing functions in migration 0028 (browse_exercises,
-- exercise_group_counts, logged_exercise_options) against a real database.
--
-- Run against a local Supabase database with every migration applied:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/exercise_browse.sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'browse-a@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'browse-b@example.test');

insert into muscle_groups (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Zz Test Group'),
  ('00000000-0000-0000-0000-0000000000f2', 'Zz Empty Group');

-- 25 shared exercises in the test group, plus one custom exercise for each user.
insert into exercises (id, user_id, name, equipment)
select ('00000000-0000-0000-0000-0000000010' || lpad(n::text, 2, '0'))::uuid, null,
       'Zz Test Lift ' || lpad(n::text, 2, '0'), case when n % 2 = 0 then 'Dumbbell' else 'Barbell' end
from generate_series(1, 25) as n;
insert into exercises (id, user_id, name, equipment) values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-00000000a001', 'Zz Farmer''s Own Carry', 'Dumbbell'),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-00000000b002', 'Zz Someone Else''s Lift', 'Barbell');
insert into exercise_muscle_groups (exercise_id, muscle_group_id)
select id, '00000000-0000-0000-0000-0000000000f1' from exercises where name like 'Zz %';

-- User A logged one test lift; user B logged another.
insert into workout_logs (id, user_id, date) values
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-00000000a001', '2026-09-20'),
  ('00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-00000000b002', '2026-09-20');
insert into logged_exercises (log_id, exercise_id) values
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000001003'),
  ('00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000001004');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

do $$
declare
  test_group constant uuid := '00000000-0000-0000-0000-0000000000f1';
  page1 text[];
  page2 text[];
  page3 text[];
  last_name text;
  last_id uuid;
  got text[];
  n integer;
begin
  -- Keyset pages of 10: 26 visible (25 shared + A's own), in name order, with no gaps or repeats.
  select array_agg(name order by name, id) into page1 from browse_exercises(test_group, null, null, null, null, 10);
  select name, id into last_name, last_id from browse_exercises(test_group, null, null, null, null, 10) order by name desc, id desc limit 1;
  select array_agg(name order by name, id) into page2 from browse_exercises(test_group, null, null, last_name, last_id, 10);
  select name, id into last_name, last_id from browse_exercises(test_group, null, null, last_name, last_id, 10) order by name desc, id desc limit 1;
  select array_agg(name order by name, id) into page3 from browse_exercises(test_group, null, null, last_name, last_id, 10);
  if cardinality(page1) <> 10 or cardinality(page2) <> 10 or cardinality(page3) <> 6 then
    raise exception 'browse_exercises: expected pages of 10, 10, 6, got %, %, %', cardinality(page1), cardinality(page2), cardinality(page3);
  end if;
  if page1[1] <> 'Zz Farmer''s Own Carry' or page1[2] <> 'Zz Test Lift 01' or page3[6] <> 'Zz Test Lift 25' then
    raise exception 'browse_exercises: pages out of name order: % ... %', page1[1:2], page3[6];
  end if;
  if exists (select unnest(page1) intersect select unnest(page2)) then
    raise exception 'browse_exercises: consecutive pages overlap';
  end if;

  -- Another user's custom exercise is never visible.
  if exists (select 1 from browse_exercises(test_group, null, null, null, null, 50) where name like 'Zz Someone%') then
    raise exception 'browse_exercises: returned another user''s custom exercise';
  end if;

  -- Search: every word must match; apostrophes are ignored; muscle group names are searchable.
  select array_agg(name) into got from browse_exercises(null, array['farmers', 'own', 'carry'], null, null, null, 50);
  if got is distinct from array['Zz Farmer''s Own Carry'] then
    raise exception 'browse_exercises: "farmers own carry" should find only Farmer''s Own Carry, got %', got;
  end if;
  select count(*) into n from browse_exercises(null, array['zz', 'test', 'group'], null, null, null, 50);
  if n <> 26 then
    raise exception 'browse_exercises: searching the muscle group name should match all 26, got %', n;
  end if;
  select count(*) into n from browse_exercises(null, array['lift', 'nomatch'], null, null, null, 50);
  if n <> 0 then
    raise exception 'browse_exercises: a word that matches nothing should return nothing, got %', n;
  end if;

  -- Equipment filter is case-insensitive.
  select count(*) into n from browse_exercises(test_group, null, 'dumbbell', null, null, 50);
  if n <> 13 then
    raise exception 'browse_exercises: expected 12 shared + 1 own dumbbell exercises, got %', n;
  end if;

  -- p_limit is clamped to 1..50.
  select count(*) into n from browse_exercises(test_group, null, null, null, null, 0);
  if n <> 1 then
    raise exception 'browse_exercises: p_limit 0 should clamp to 1, got %', n;
  end if;

  -- Counts agree with what browsing returns, and list empty groups as 0.
  select exercise_count into n from exercise_group_counts() where muscle_group_id = test_group;
  if n <> 26 then
    raise exception 'exercise_group_counts: expected 26 in the test group, got %', n;
  end if;
  select exercise_count into n from exercise_group_counts(null, 'Barbell') where muscle_group_id = test_group;
  if n <> 13 then
    raise exception 'exercise_group_counts: expected 13 barbell exercises, got %', n;
  end if;
  select exercise_count into n from exercise_group_counts() where muscle_group_id = '00000000-0000-0000-0000-0000000000f2';
  if n <> 0 then
    raise exception 'exercise_group_counts: an empty group should count 0, got %', n;
  end if;

  -- Only exercises this user has logged.
  select array_agg(name) into got from logged_exercise_options() where name like 'Zz %';
  if got is distinct from array['Zz Test Lift 03'] then
    raise exception 'logged_exercise_options: expected only Zz Test Lift 03, got %', got;
  end if;
end $$;

select 'exercise_browse: all checks passed' as result;

rollback;
