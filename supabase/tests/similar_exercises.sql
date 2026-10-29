-- Checks for migration 0042: similar_exercises finds exercises whose muscle groups overlap by at
-- least two thirds, marks the exact matches, and only returns exercises the caller can see.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f101', 'swap-a@example.test'),
  ('00000000-0000-0000-0000-00000000f102', 'swap-b@example.test');

insert into muscle_groups (id, name) values
  ('00000000-0000-0000-0000-00000000f201', 'Zz Chest'),
  ('00000000-0000-0000-0000-00000000f202', 'Zz Triceps'),
  ('00000000-0000-0000-0000-00000000f203', 'Zz Shoulders');

insert into exercises (id, user_id, name, equipment) values
  ('00000000-0000-0000-0000-00000000f301', null, 'Zz Bench', 'Barbell'),
  ('00000000-0000-0000-0000-00000000f302', null, 'Zz Dumbbell Bench', 'Dumbbell'),
  ('00000000-0000-0000-0000-00000000f303', null, 'Zz Push-Up', 'Bodyweight'),
  ('00000000-0000-0000-0000-00000000f304', null, 'Zz Pushdown', 'Cable'),
  ('00000000-0000-0000-0000-00000000f305', '00000000-0000-0000-0000-00000000f101', 'Zz A''s Press', 'Machine'),
  ('00000000-0000-0000-0000-00000000f306', '00000000-0000-0000-0000-00000000f102', 'Zz B''s Press', 'Machine');

insert into exercise_muscle_groups (exercise_id, muscle_group_id) values
  -- Bench, Dumbbell Bench, A's Press, B's Press: chest, triceps, shoulders.
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f201'),
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f202'),
  ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f203'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000f201'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000f202'),
  ('00000000-0000-0000-0000-00000000f302', '00000000-0000-0000-0000-00000000f203'),
  ('00000000-0000-0000-0000-00000000f305', '00000000-0000-0000-0000-00000000f201'),
  ('00000000-0000-0000-0000-00000000f305', '00000000-0000-0000-0000-00000000f202'),
  ('00000000-0000-0000-0000-00000000f305', '00000000-0000-0000-0000-00000000f203'),
  ('00000000-0000-0000-0000-00000000f306', '00000000-0000-0000-0000-00000000f201'),
  ('00000000-0000-0000-0000-00000000f306', '00000000-0000-0000-0000-00000000f202'),
  ('00000000-0000-0000-0000-00000000f306', '00000000-0000-0000-0000-00000000f203'),
  -- Push-Up: chest, triceps (2 of 3: close enough). Pushdown: triceps only (1 of 3: not).
  ('00000000-0000-0000-0000-00000000f303', '00000000-0000-0000-0000-00000000f201'),
  ('00000000-0000-0000-0000-00000000f303', '00000000-0000-0000-0000-00000000f202'),
  ('00000000-0000-0000-0000-00000000f304', '00000000-0000-0000-0000-00000000f202');

do $$
begin
  if not has_function_privilege('authenticated', 'similar_exercises(uuid)', 'execute') then
    raise exception 'signed-in people must be able to call similar_exercises';
  end if;
end $$;

-- Signed in as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000f101", "role": "authenticated"}', true);

do $$
declare
  got text;
begin
  select string_agg(name || ':' || exact, ', ' order by name) into got
  from similar_exercises('00000000-0000-0000-0000-00000000f301')
  where name like 'Zz %';
  if got is distinct from 'Zz A''s Press:true, Zz Dumbbell Bench:true, Zz Push-Up:false' then
    raise exception 'similar to Zz Bench (as A): got %', got;
  end if;

  -- Another person's custom exercise can't be used to probe their library.
  if exists (select 1 from similar_exercises('00000000-0000-0000-0000-00000000f306')) then
    raise exception 'B''s custom exercise must not be visible to A';
  end if;
end $$;

reset role;
set local role anon;
do $$
begin
  perform * from similar_exercises('00000000-0000-0000-0000-00000000f301');
  raise exception 'anon must not be able to call similar_exercises';
exception when insufficient_privilege then
  null;
end $$;
reset role;

rollback;
