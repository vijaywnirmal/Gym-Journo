-- The whole leave journey for one person (charter: "ownership of their fitness records, including
-- after leaving a trainer or gym"): someone who trains with a trainer and at a gym leaves both, then
-- deletes their account.
--   After leaving: their workouts, body weight and the plans their trainer made all stay theirs,
--   and neither the trainer nor the gym can see any of it, by any route.
--   After deleting: nothing of theirs is left in any table, and the trainer and gym carry on.
-- Plus a guard for tables added later: every link to an account must go with it (or be cleared)
-- when the account is deleted, so a new table can't quietly keep someone's data.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- The guard: no foreign key to an account may block or outlive its deletion.
do $$
declare
  bad text;
begin
  select string_agg(format('%s (%s)', c.conrelid::regclass, c.conname), ', ') into bad
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
    and c.connamespace = 'public'::regnamespace
    and c.confdeltype not in ('c', 'n');  -- cascade, set null
  if bad is not null then
    raise exception 'deleting an account must delete or clear every link to it; these would block or keep it: %', bad;
  end if;
end $$;

-- P trains with trainer T and is a member of O's gym. T made one of P's plans.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e1001', 'leave-person@example.test'),
  ('00000000-0000-0000-0000-0000000e1002', 'leave-trainer@example.test'),
  ('00000000-0000-0000-0000-0000000e1003', 'leave-owner@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-0000000e1001', true, 'Priya', 'UTC'),
  ('00000000-0000-0000-0000-0000000e1002', true, 'Tarun', 'UTC'),
  ('00000000-0000-0000-0000-0000000e1003', true, 'Omar', 'UTC')
on conflict (id) do update set onboarded = true, timezone = 'UTC';
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000e1002', 'Tarun');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-0000000e1002', '00000000-0000-0000-0000-0000000e1001');
insert into gyms (id, owner_id, name) values
  ('00000000-0000-0000-0000-0000000e1100', '00000000-0000-0000-0000-0000000e1003', 'Leave Test Gym');
insert into gym_members (gym_id, user_id) values
  ('00000000-0000-0000-0000-0000000e1100', '00000000-0000-0000-0000-0000000e1001');

insert into workout_logs (id, user_id, date, notes) values
  ('00000000-0000-0000-0000-0000000e1201', '00000000-0000-0000-0000-0000000e1001', '2026-10-01', 'Leg day');
insert into logged_exercises (id, log_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000e1202', '00000000-0000-0000-0000-0000000e1201',
   (select id from exercises where user_id is null order by name limit 1), 0);
insert into logged_sets (logged_exercise_id, set_number, reps, weight) values
  ('00000000-0000-0000-0000-0000000e1202', 1, 8, 60);
insert into body_measurements (user_id, date, weight_kg) values ('00000000-0000-0000-0000-0000000e1001', '2026-10-01', 70);
-- A plan's author is stamped from whoever is signed in (migration 0035), so T is signed in for it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1002","role":"authenticated"}', true);
insert into workout_plans (user_id, date, title) values
  ('00000000-0000-0000-0000-0000000e1001', '2026-10-05', 'From Tarun');
select set_config('request.jwt.claims', '', true);

set local role authenticated;

-- Before leaving, the trainer and the gym can see P (so the checks after leaving mean something).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1002","role":"authenticated"}', true);
do $$
begin
  if jsonb_array_length(client_logs('00000000-0000-0000-0000-0000000e1001', '2026-09-01', '2026-10-31')) <> 1 then
    raise exception 'before P leaves, T should see P''s workout';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1003","role":"authenticated"}', true);
do $$
begin
  if not exists (select 1 from gym_member_overview('00000000-0000-0000-0000-0000000e1100')
                 where member_id = '00000000-0000-0000-0000-0000000e1001') then
    raise exception 'before P leaves, the gym should list P';
  end if;
end $$;

-- P leaves the trainer and the gym, from their own Profile.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1001","role":"authenticated"}', true);
do $$
begin
  if not end_trainer_link((select id from trainer_clients where client_id = auth.uid() and status = 'active')) then
    raise exception 'P should be able to leave their trainer';
  end if;
  if not end_gym_membership('00000000-0000-0000-0000-0000000e1100', auth.uid()) then
    raise exception 'P should be able to leave the gym';
  end if;

  -- Everything stays P's.
  if (select count(*) from workout_logs) <> 1 or (select count(*) from logged_sets) <> 1 then
    raise exception 'P''s workouts should stay after leaving';
  end if;
  if (select count(*) from body_measurements) <> 1 then
    raise exception 'P''s body weight should stay after leaving';
  end if;
  if (select count(*) from workout_plans where created_by = '00000000-0000-0000-0000-0000000e1002') <> 1 then
    raise exception 'the plan the trainer made should stay with P after leaving';
  end if;
end $$;

-- The trainer sees nothing of P's, by any route.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1002","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from workout_logs where user_id = '00000000-0000-0000-0000-0000000e1001')
     or exists (select 1 from logged_sets)
     or exists (select 1 from workout_plans where user_id = '00000000-0000-0000-0000-0000000e1001')
     or exists (select 1 from body_measurements where user_id = '00000000-0000-0000-0000-0000000e1001') then
    raise exception 'after P leaves, T must not read P''s rows directly';
  end if;
  if exists (select 1 from trainer_client_overview() where client_id = '00000000-0000-0000-0000-0000000e1001') then
    raise exception 'after P leaves, P must not be on T''s client list';
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-0000000e1001', '2026-09-01', '2026-10-31');
    raise exception 'after P leaves, T must not read P''s workouts' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The gym no longer lists P.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e1003","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from gym_member_overview('00000000-0000-0000-0000-0000000e1100')
             where member_id = '00000000-0000-0000-0000-0000000e1001') then
    raise exception 'after P leaves, the gym must not list P';
  end if;
  if exists (select 1 from workout_logs where user_id = '00000000-0000-0000-0000-0000000e1001') then
    raise exception 'the gym must never read P''s workouts';
  end if;
end $$;

select set_config('request.jwt.claims', '', true);
reset role;

-- P deletes their account (Auth removes the user; every link to it goes with it or is cleared).
delete from auth.users where id = '00000000-0000-0000-0000-0000000e1001';

do $$
declare
  fk record;
  n bigint;
  left_over text := '';
begin
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and c.connamespace = 'public'::regnamespace
  loop
    execute format('select count(*) from %s where %I = %L', fk.tbl, fk.col, '00000000-0000-0000-0000-0000000e1001') into n;
    if n > 0 then left_over := left_over || format('%s.%s (%s) ', fk.tbl, fk.col, n); end if;
  end loop;
  if left_over <> '' then
    raise exception 'after deleting the account, rows still point at it: %', left_over;
  end if;
  if exists (select 1 from logged_sets where logged_exercise_id = '00000000-0000-0000-0000-0000000e1202') then
    raise exception 'after deleting the account, its sets should be gone';
  end if;

  -- The trainer and the gym carry on.
  if not exists (select 1 from trainer_profiles where user_id = '00000000-0000-0000-0000-0000000e1002')
     or not exists (select 1 from gyms where id = '00000000-0000-0000-0000-0000000e1100') then
    raise exception 'the trainer and the gym should be untouched by P deleting their account';
  end if;
end $$;

select 'leave_journey: all checks passed' as result;

rollback;
