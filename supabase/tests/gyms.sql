-- Checks for migration 0037 (gyms): only a gym's owner and admins run it; it sees counts and dates
-- about its members, never their workouts; it can assign its own trainers but never take over a
-- trainer a member found themselves; and leaving, from either side, ends what the gym arranged.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- A check that a step fails raises with its own code (P0099) when the step doesn't, so the
-- "expected error" handlers around it can never mistake that for the error they expect.

-- O owns the gym; A is its admin; T and T2 train there; P trains privately; M1, M2 and M3 are
-- members (M3 found P themselves); X is anyone; N hasn't finished onboarding.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000090a0', 'gym-owner@example.test'),
  ('00000000-0000-0000-0000-0000000090ad', 'gym-admin@example.test'),
  ('00000000-0000-0000-0000-0000000090b1', 'gym-trainer-1@example.test'),
  ('00000000-0000-0000-0000-0000000090b2', 'gym-trainer-2@example.test'),
  ('00000000-0000-0000-0000-0000000090bf', 'private-trainer@example.test'),
  ('00000000-0000-0000-0000-0000000090c1', 'member-1@example.test'),
  ('00000000-0000-0000-0000-0000000090c2', 'member-2@example.test'),
  ('00000000-0000-0000-0000-0000000090c3', 'member-3@example.test'),
  ('00000000-0000-0000-0000-0000000090ee', 'anyone@example.test'),
  ('00000000-0000-0000-0000-0000000090ef', 'new@example.test');

insert into profiles (id, onboarded, first_name, timezone, date_of_birth, height_cm, gender) values
  ('00000000-0000-0000-0000-0000000090a0', true, 'Owner', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090ad', true, 'Admin', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090b1', true, 'Tara', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090b2', true, 'Tomas', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090bf', true, 'Pat', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090c1', true, 'Mina', 'Asia/Kolkata', '1990-01-01', 170, 'female'),
  ('00000000-0000-0000-0000-0000000090c2', true, 'Manu', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090c3', true, 'Mo', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090ee', true, 'Xia', 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-0000000090ef', false, null, null, null, null, null);
insert into trainer_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000090b1', 'Tara'),
  ('00000000-0000-0000-0000-0000000090b2', 'Tomas'),
  ('00000000-0000-0000-0000-0000000090bf', 'Pat');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-0000000090bf', '00000000-0000-0000-0000-0000000090c3');

-- M1 worked out today and weighed in.
insert into exercises (id, user_id, name) values ('00000000-0000-0000-0000-0000000090d1', null, 'Gym Test Squat');
insert into workout_logs (id, user_id, date, notes) values
  ('00000000-0000-0000-0000-0000000091a1', '00000000-0000-0000-0000-0000000090c1', (now() at time zone 'Asia/Kolkata')::date, 'private note');
insert into logged_exercises (id, log_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000091b1', '00000000-0000-0000-0000-0000000091a1', '00000000-0000-0000-0000-0000000090d1', 0);
insert into logged_sets (logged_exercise_id, set_number, reps, weight) values ('00000000-0000-0000-0000-0000000091b1', 1, 5, 60);
insert into body_measurements (user_id, date, weight_kg) values ('00000000-0000-0000-0000-0000000090c1', current_date, 58);

-- Signed out: nothing.
set local role anon;
do $$
begin
  begin
    perform 1 from gyms;
    raise exception 'anon must not read gyms';
  exception when insufficient_privilege then null;
  end;
  begin
    perform create_gym('x', null, null, null);
    raise exception 'anon must not create a gym';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if has_function_privilege('authenticated', 'require_gym_admin(uuid)', 'execute')
     or has_function_privilege('authenticated', 'end_gym_trainer_link(uuid, uuid)', 'execute') then
    raise exception 'internal helpers must not be callable by authenticated';
  end if;
end $$;

-- O signs up the gym and makes its links.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
declare
  v_gym gyms;
  v_old text;
  v_member gym_invites;
  v_trainer gym_invites;
begin
  v_gym := create_gym(' Iron Test Gym ', 'Pune', 'Baner', '+919800000000');
  if v_gym.owner_id <> auth.uid() or v_gym.name <> 'Iron Test Gym' or not is_gym_admin(v_gym.id) then
    raise exception 'the owner should run the new gym';
  end if;
  perform set_config('test.gym', v_gym.id::text, true);

  v_old := (create_gym_invite(v_gym.id, 'member')).code;
  v_member := create_gym_invite(v_gym.id, 'member');
  v_trainer := create_gym_invite(v_gym.id, 'trainer');
  if v_member.expires_at is not null or v_trainer.expires_at is null or v_member.code = v_old then
    raise exception 'member links should not expire, trainer links should, and a new link should be new';
  end if;
  if (select state from gym_invite_details(v_old)) <> 'expired' then
    raise exception 'a replaced member link should read as expired';
  end if;
  perform set_config('test.member_code', v_member.code, true);
  perform set_config('test.trainer_code', v_trainer.code, true);
  perform set_config('test.admin_code', (create_gym_invite(v_gym.id, 'admin')).code, true);

  update gyms set city = 'Pune West' where id = v_gym.id;
  if (select city from gyms where id = v_gym.id) <> 'Pune West' then
    raise exception 'the owner should be able to edit the gym';
  end if;
end $$;

-- X isn't in the gym: sees nothing and can't run it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ee","role":"authenticated"}', true);
do $$
declare
  v_gym uuid := current_setting('test.gym')::uuid;
begin
  if exists (select 1 from gyms) or exists (select 1 from gym_invites) then
    raise exception 'X should see no gym and no links';
  end if;
  begin
    perform create_gym_invite(v_gym, 'member');
    raise exception 'X must not make links for the gym';
  exception when insufficient_privilege then null;
  end;
  begin
    perform gym_member_overview(v_gym);
    raise exception 'X must not see the members';
  exception when insufficient_privilege then null;
  end;
  -- X has no trainer account, so the trainer link asks for one first.
  if (select state from gym_invite_details(current_setting('test.trainer_code'))) <> 'needs_trainer_profile' then
    raise exception 'a trainer link should ask for a trainer account first';
  end if;
  begin
    perform accept_gym_invite(current_setting('test.trainer_code'));
    raise exception 'X must not join as a trainer without a trainer account' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%trainer account%' then raise; end if;
  end;
end $$;

-- A joins as admin: runs the gym, but can't add more admins.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ad","role":"authenticated"}', true);
do $$
declare
  v_gym uuid := current_setting('test.gym')::uuid;
begin
  -- (Separate statements: a check in the same statement as the change would read the old rows.)
  if accept_gym_invite(current_setting('test.admin_code')) <> 'admin' then
    raise exception 'accepting an admin link should return admin';
  end if;
  if not is_gym_admin(v_gym) then
    raise exception 'A should be an admin after accepting';
  end if;
  perform create_gym_invite(v_gym, 'member');
  begin
    perform create_gym_invite(v_gym, 'admin');
    raise exception 'only the owner adds admins';
  exception when insufficient_privilege then null;
  end;
  -- That new member link replaced O's; the test carries on with A's.
  perform set_config('test.member_code',
    (select code from gym_invites where gym_id = v_gym and role = 'member' and revoked_at is null), true);
end $$;

-- T and T2 join as trainers; N can't join as a member before onboarding; M1, M2, M3 join.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b1","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.trainer_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.trainer_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ef","role":"authenticated"}', true);
do $$
begin
  begin
    perform accept_gym_invite(current_setting('test.member_code'));
    raise exception 'N must finish onboarding first' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Finish setting up%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
do $$
begin
  if (select state from gym_invite_details(current_setting('test.member_code'))) <> 'valid' then
    raise exception 'the member link should be valid';
  end if;
  perform accept_gym_invite(current_setting('test.member_code'));
  perform accept_gym_invite(current_setting('test.member_code'));
  if (select count(*) from gym_members where status = 'active') <> 1 then
    raise exception 'joining twice should leave one membership';
  end if;
  if (select state from gym_invite_details(current_setting('test.member_code'))) <> 'current' then
    raise exception 'a member opening the link again should read as current';
  end if;
  if (select name from gyms) <> 'Iron Test Gym' then
    raise exception 'a member should see their gym';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.member_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c3","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.member_code'));

-- O: the members list is counts and dates; the workouts themselves stay private.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
declare
  v_gym uuid := current_setting('test.gym')::uuid;
  v_row record;
begin
  if (select count(*) from gym_member_overview(v_gym)) <> 3 then
    raise exception 'the gym should list its three members';
  end if;
  select * into v_row from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c1';
  if v_row.workouts_this_week <> 1 or v_row.last_workout_on <> (now() at time zone 'Asia/Kolkata')::date
     or v_row.trainer_id is not null or v_row.has_own_trainer then
    raise exception 'M1''s row is wrong: %', row_to_json(v_row);
  end if;
  if exists (
    select 1 from jsonb_object_keys(to_jsonb(v_row)) as k
    where k ~ '(birth|height|gender|email|weight|note|timezone)'
  ) then
    raise exception 'the members list must not expose private fields';
  end if;
  select * into v_row from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c3';
  if not v_row.has_own_trainer or v_row.trainer_name is not null then
    raise exception 'M3''s own trainer should show only as has_own_trainer';
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-0000000090c1', current_date - 7, current_date);
    raise exception 'the gym must not read a member''s workouts';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from workout_logs) or exists (select 1 from body_measurements) then
    raise exception 'the gym must not read a member''s logs or body weight directly';
  end if;

  -- Assigning, reassigning, and what the gym can't do.
  if (assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1')).gym_id <> v_gym then
    raise exception 'the link should record the gym';
  end if;
  if (select trainer_name from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c1') <> 'Tara' then
    raise exception 'the members list should name the assigned trainer';
  end if;
  perform assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b2');
  -- The owner can't read links directly (only through the overview); one active link per client is
  -- the trainer_clients_one_active index.
  if (select trainer_id from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c1')
     <> '00000000-0000-0000-0000-0000000090b2' then
    raise exception 'reassigning should move M1 from Tara to Tomas';
  end if;
  begin
    perform assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c3', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'the gym must not take over a member''s own trainer' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%own trainer%' then raise; end if;
  end;
  begin
    perform assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090bf');
    raise exception 'only the gym''s own trainers can be assigned' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a trainer at this gym%' then raise; end if;
  end;
  begin
    perform assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090ee', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'only members can be assigned' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a member%' then raise; end if;
  end;
  perform assign_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090b1');
end $$;

-- A gym trainer isn't an admin; the assigned trainer works with the member as any trainer does.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b1","role":"authenticated"}', true);
do $$
begin
  begin
    perform assign_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'a trainer must not assign members';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from gym_members) <> 0 then
    raise exception 'a trainer should not see the member list rows';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
do $$
begin
  if not is_trainer_of('00000000-0000-0000-0000-0000000090c1')
     or jsonb_array_length(client_logs('00000000-0000-0000-0000-0000000090c1',
          (now() at time zone 'Asia/Kolkata')::date - 7, (now() at time zone 'Asia/Kolkata')::date)) <> 1 then
    raise exception 'Tomas should work with M1 like any trainer';
  end if;
  perform save_client_plan('00000000-0000-0000-0000-0000000090c1', (now() at time zone 'Asia/Kolkata')::date, 'Legs', null, '{}', '[]');
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
declare
  v_row record;
begin
  select * into v_row from gym_trainer_overview(current_setting('test.gym')::uuid) where trainer_id = '00000000-0000-0000-0000-0000000090b2';
  if v_row.members_assigned <> 1 or v_row.plans_this_week <> 1 or v_row.members_inactive_7_days <> 0 then
    raise exception 'Tomas''s row is wrong: %', row_to_json(v_row);
  end if;
  select * into v_row from gym_trainer_overview(current_setting('test.gym')::uuid) where trainer_id = '00000000-0000-0000-0000-0000000090b1';
  if v_row.members_assigned <> 1 or v_row.members_inactive_7_days <> 1 then
    raise exception 'Tara''s row is wrong (M2 hasn''t trained): %', row_to_json(v_row);
  end if;
end $$;

-- Tomas leaves the gym: he stops training M1; M3's private trainer is untouched.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
do $$
begin
  if not end_gym_staff(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090b2', 'trainer') then
    raise exception 'Tomas should be able to leave';
  end if;
  if is_trainer_of('00000000-0000-0000-0000-0000000090c1') then
    raise exception 'Tomas must lose M1 when he leaves the gym';
  end if;
end $$;

-- M2 switches to another gym: the first membership and its trainer end together.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ee","role":"authenticated"}', true);
select set_config('test.other_gym', (create_gym('Other Gym', null, null, null)).id::text, true);
select set_config('test.other_code', (create_gym_invite(current_setting('test.other_gym')::uuid, 'member')).code, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
do $$
begin
  perform accept_gym_invite(current_setting('test.other_code'));
  if (select gym_id from gym_members where status = 'active') <> current_setting('test.other_gym')::uuid
     or exists (select 1 from trainer_clients where status = 'active') then
    raise exception 'switching gyms should end the old membership and its trainer';
  end if;
end $$;

-- M1 leaves; the admin removes M3 (whose private trainer stays); the owner removes the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
do $$
begin
  perform set_config('test.dummy', '', true);
  if end_gym_membership(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c2') then
    raise exception 'a member must not remove someone else';
  end if;
exception when insufficient_privilege then null;
end $$;
do $$
begin
  if not end_gym_membership(current_setting('test.gym')::uuid, auth.uid()) then
    raise exception 'M1 should be able to leave';
  end if;
  if exists (select 1 from gym_members where status = 'active') then
    raise exception 'M1''s membership should have ended';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ad","role":"authenticated"}', true);
do $$
begin
  if not end_gym_membership(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c3') then
    raise exception 'the admin should be able to remove M3';
  end if;
  begin
    perform end_gym_staff(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090ad', 'admin');
  end;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from trainer_clients where client_id = '00000000-0000-0000-0000-0000000090c3' and status = 'active' and gym_id is null) then
    raise exception 'M3''s private trainer should be untouched by leaving the gym';
  end if;
  if exists (select 1 from gym_staff where user_id = '00000000-0000-0000-0000-0000000090ad' and status = 'active') then
    raise exception 'an admin should be able to step down';
  end if;
end $$;

-- The owner deletes their account: the gym goes, and a trainer it assigned stays on as a private one.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.member_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
select assign_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
reset role;
select set_config('request.jwt.claims', '', true);
-- Test-only: Postgres re-checks a foreign key on any update of a row inserted in the same
-- transaction, so the "ended by the owner" rows this test wrote moments ago would trip over the gym
-- being deleted in the same statement. Real links are written long before; clearing ended_by here
-- keeps the check about the gym itself.
update trainer_clients set ended_by = null where ended_by = '00000000-0000-0000-0000-0000000090a0';
delete from auth.users where id = '00000000-0000-0000-0000-0000000090a0';
do $$
begin
  if exists (select 1 from gyms where id = current_setting('test.gym')::uuid)
     or exists (select 1 from gym_members where gym_id = current_setting('test.gym')::uuid)
     or exists (select 1 from gym_staff where gym_id = current_setting('test.gym')::uuid) then
    raise exception 'deleting the owner should delete the gym and its rows';
  end if;
  if not exists (
    select 1 from trainer_clients
    where client_id = '00000000-0000-0000-0000-0000000090c1' and trainer_id = '00000000-0000-0000-0000-0000000090b1'
      and status = 'active' and gym_id is null
  ) then
    raise exception 'the gym''s assigned link should carry on as a private one';
  end if;
end $$;

rollback;
