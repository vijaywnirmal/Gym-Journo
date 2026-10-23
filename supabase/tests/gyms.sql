-- Checks for migration 0037 (gyms): only a gym's owner and admins run it, and only the owner adds or
-- removes admins or owns it; it sees counts and dates about its members, never their workouts; a
-- trainer it suggests sees nothing until the member accepts them by name; it never takes over a
-- trainer a member found themselves; and leaving, from either side, ends what the gym arranged.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- A check that a step fails raises with its own code (P0099) when the step doesn't, so the
-- "expected error" handlers around it can never mistake that for the error they expect.

-- O owns the gym; A and A2 are its admins; T and T2 train there; P trains privately; M1, M2 and M3
-- are members (M3 found P themselves); X runs another gym; N hasn't finished onboarding.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000090a0', 'gym-owner@example.test'),
  ('00000000-0000-0000-0000-0000000090ad', 'gym-admin@example.test'),
  ('00000000-0000-0000-0000-0000000090ae', 'gym-admin-2@example.test'),
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
  ('00000000-0000-0000-0000-0000000090ae', true, 'Ada', 'Asia/Kolkata', null, null, null),
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
    raise exception 'anon must not read gyms' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform create_gym('x', null, null, null);
    raise exception 'anon must not create a gym' using errcode = 'P0099';
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
  if has_table_privilege('authenticated', 'gym_members', 'insert')
     or has_table_privilege('authenticated', 'gym_trainer_offers', 'update')
     or has_column_privilege('authenticated', 'gyms', 'owner_id', 'update') then
    raise exception 'gym rows must only be written through the functions';
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
  perform set_config('test.old_member_code', v_old, true);
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
    raise exception 'X must not make links for the gym' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform gym_member_overview(v_gym);
    raise exception 'X must not see the members' using errcode = 'P0099';
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
  begin
    perform accept_gym_invite(current_setting('test.old_member_code'));
    raise exception 'a replaced link must not work' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;
end $$;

-- A joins as admin: runs the gym, but can't add admins, see admin links or take the gym over.
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
  if (select state from gym_invite_details(current_setting('test.admin_code'))) <> 'current' then
    raise exception 'A opening the admin link again should read as current';
  end if;
  perform create_gym_invite(v_gym, 'member');
  begin
    perform create_gym_invite(v_gym, 'admin');
    raise exception 'only the owner adds admins' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from gym_invites where role = 'admin')
     or not exists (select 1 from gym_invites where role = 'trainer') then
    raise exception 'an admin should see the trainer and member links but not admin links';
  end if;
  begin
    update gyms set owner_id = auth.uid() where id = v_gym;
    raise exception 'an admin must not make themselves the owner' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  update gyms set area = 'Baner Road' where id = v_gym;
  -- That new member link replaced O's; the test carries on with A's.
  perform set_config('test.member_code',
    (select code from gym_invites where gym_id = v_gym and role = 'member' and revoked_at is null), true);
end $$;

-- An admin link works once: X can't use the one A used.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ee","role":"authenticated"}', true);
do $$
begin
  if (select state from gym_invite_details(current_setting('test.admin_code'))) <> 'expired' then
    raise exception 'a used admin link should read as expired';
  end if;
  begin
    perform accept_gym_invite(current_setting('test.admin_code'));
    raise exception 'a used admin link must not work again' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;
end $$;

-- O adds A2 as a second admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
select set_config('test.admin_code_2', (create_gym_invite(current_setting('test.gym')::uuid, 'admin')).code, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ae","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.admin_code_2'));

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

-- A member can't remove another member.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
do $$
begin
  begin
    perform end_gym_membership(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c2');
    raise exception 'a member must not remove someone else' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform end_gym_membership(current_setting('test.gym')::uuid, null);
    raise exception 'a missing person must not skip the admin check' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;

-- O: the members list is counts and dates; the workouts themselves stay private.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
declare
  v_gym uuid := current_setting('test.gym')::uuid;
  v_row record;
  v_offer gym_trainer_offers;
begin
  if (select count(*) from gym_member_overview(v_gym)) <> 3 then
    raise exception 'the gym should list its three members';
  end if;
  select * into v_row from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c1';
  if v_row.workouts_this_week <> 1 or v_row.days_since_last_workout <> 0
     or v_row.trainer_id is not null or v_row.offered_trainer_id is not null or v_row.has_own_trainer then
    raise exception 'M1''s row is wrong: %', row_to_json(v_row);
  end if;
  if exists (
    select 1 from jsonb_object_keys(to_jsonb(v_row)) as k
    where k ~ '(birth|height|gender|email|weight|note|timezone|today|date)'
  ) then
    raise exception 'the members list must not expose private fields';
  end if;
  select * into v_row from gym_member_overview(v_gym) where member_id = '00000000-0000-0000-0000-0000000090c3';
  if not v_row.has_own_trainer or v_row.trainer_name is not null then
    raise exception 'M3''s own trainer should show only as has_own_trainer';
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-0000000090c1', current_date - 7, current_date);
    raise exception 'the gym must not read a member''s workouts' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from workout_logs) or exists (select 1 from body_measurements) then
    raise exception 'the gym must not read a member''s logs or body weight directly';
  end if;

  -- Suggesting trainers, and what the gym can't do.
  v_offer := offer_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
  if v_offer.status <> 'pending' or v_offer.gym_id <> v_gym then
    raise exception 'suggesting a trainer should make a pending offer';
  end if;
  perform set_config('test.m1_offer', v_offer.id::text, true);
  begin
    perform offer_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c3', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'the gym must not take over a member''s own trainer' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%own trainer%' then raise; end if;
  end;
  begin
    perform offer_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090bf');
    raise exception 'only the gym''s own trainers can be suggested' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a trainer at this gym%' then raise; end if;
  end;
  begin
    perform offer_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090ee', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'only members can be suggested a trainer' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a member%' then raise; end if;
  end;
  perform offer_gym_trainer(v_gym, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090b1');
end $$;
do $$
declare
  v_row record;
begin
  select * into v_row from gym_member_overview(current_setting('test.gym')::uuid) where member_id = '00000000-0000-0000-0000-0000000090c1';
  if v_row.offered_trainer_name is distinct from 'Tara' or v_row.trainer_id is not null then
    raise exception 'an open offer should show as offered, not as the trainer: %', row_to_json(v_row);
  end if;
end $$;

-- Until M1 accepts, Tara sees nothing; a trainer can't suggest trainers.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b1","role":"authenticated"}', true);
do $$
begin
  if is_trainer_of('00000000-0000-0000-0000-0000000090c1') then
    raise exception 'a suggested trainer must not be the member''s trainer before they accept';
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-0000000090c1', current_date - 7, current_date);
    raise exception 'a suggested trainer must not read workouts before the member accepts' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
    raise exception 'a trainer must not suggest trainers' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from gym_members) or exists (select 1 from gym_trainer_offers) then
    raise exception 'a trainer should not see member or offer rows';
  end if;
  begin
    perform gym_admin_list(current_setting('test.gym')::uuid);
    raise exception 'a trainer must not list the admins' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;

-- M2 can't answer M1's offer; M1 sees it by name and accepts; M2 declines theirs.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
do $$
begin
  begin
    perform respond_gym_trainer_offer(current_setting('test.m1_offer')::uuid, true);
    raise exception 'a member must not answer someone else''s offer' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%no longer open%' then raise; end if;
  end;
  perform respond_gym_trainer_offer((select offer_id from my_gym_trainer_offer()), false);
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
do $$
declare
  v_offer record;
begin
  select * into v_offer from my_gym_trainer_offer();
  if v_offer.gym_name <> 'Iron Test Gym' or v_offer.trainer_name <> 'Tara' then
    raise exception 'the member should see who the gym suggests: %', row_to_json(v_offer);
  end if;
  if not respond_gym_trainer_offer(v_offer.offer_id, true) then
    raise exception 'accepting should succeed';
  end if;
end $$;
do $$
begin
  if exists (select 1 from my_gym_trainer_offer()) then
    raise exception 'an accepted offer should no longer be open';
  end if;
  if (select gym_id from trainer_clients where status = 'active') is distinct from current_setting('test.gym')::uuid then
    raise exception 'the link should record the gym that arranged it';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b1","role":"authenticated"}', true);
do $$
begin
  if not is_trainer_of('00000000-0000-0000-0000-0000000090c1')
     or jsonb_array_length(client_logs('00000000-0000-0000-0000-0000000090c1',
          (now() at time zone 'Asia/Kolkata')::date - 7, (now() at time zone 'Asia/Kolkata')::date)) <> 1 then
    raise exception 'once accepted, Tara should work with M1 like any trainer';
  end if;
  if is_trainer_of('00000000-0000-0000-0000-0000000090c2') then
    raise exception 'a declined offer must not link the trainer';
  end if;
end $$;

-- O moves M1 to Tomas: Tara keeps M1 until M1 accepts Tomas. M2 is offered Tara again and accepts.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
select offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b2');
select offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090b1');
do $$
declare
  v_row record;
begin
  select * into v_row from gym_member_overview(current_setting('test.gym')::uuid) where member_id = '00000000-0000-0000-0000-0000000090c1';
  if v_row.trainer_name is distinct from 'Tara' or v_row.offered_trainer_name is distinct from 'Tomas' then
    raise exception 'M1 should stay with Tara while Tomas is offered: %', row_to_json(v_row);
  end if;
  if offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1') is not null then
    raise exception 'suggesting the trainer a member already has should change nothing';
  end if;
end $$;
do $$
begin
  if (select offered_trainer_id from gym_member_overview(current_setting('test.gym')::uuid)
      where member_id = '00000000-0000-0000-0000-0000000090c1') is not null then
    raise exception 'suggesting M1''s current trainer should withdraw the Tomas offer';
  end if;
end $$;
select offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b2');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
select respond_gym_trainer_offer((select offer_id from my_gym_trainer_offer()), true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
select respond_gym_trainer_offer((select offer_id from my_gym_trainer_offer()), true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
do $$
begin
  if not is_trainer_of('00000000-0000-0000-0000-0000000090c1') then
    raise exception 'Tomas should train M1 after M1 accepts';
  end if;
  perform save_client_plan('00000000-0000-0000-0000-0000000090c1', (now() at time zone 'Asia/Kolkata')::date, 'Legs', null, '{}', '[]');
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b1","role":"authenticated"}', true);
do $$
begin
  if is_trainer_of('00000000-0000-0000-0000-0000000090c1') then
    raise exception 'Tara must lose M1 when M1 moves to Tomas';
  end if;
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

-- Only the owner removes admins; a removed admin can't come back on the used link.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ad","role":"authenticated"}', true);
do $$
begin
  if (select array_agg(first_name order by first_name) from gym_admin_list(current_setting('test.gym')::uuid)) <> array['Ada', 'Admin'] then
    raise exception 'admins should see who runs the gym';
  end if;
  begin
    perform end_gym_staff(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090ae', 'admin');
    raise exception 'an admin must not remove another admin' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
begin
  if not end_gym_staff(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090ae', 'admin') then
    raise exception 'the owner should be able to remove an admin';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ae","role":"authenticated"}', true);
do $$
begin
  if is_gym_admin(current_setting('test.gym')::uuid) then
    raise exception 'a removed admin must not run the gym';
  end if;
  begin
    perform accept_gym_invite(current_setting('test.admin_code_2'));
    raise exception 'a removed admin must not rejoin on the same link' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;
end $$;

-- X runs another gym, where Tomas also trains. M2 switches to it: the first membership and the
-- trainer it arranged end together, and X's gym links M2 with Tomas.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ee","role":"authenticated"}', true);
select set_config('test.other_gym', (create_gym('Other Gym', null, null, null)).id::text, true);
select set_config('test.other_code', (create_gym_invite(current_setting('test.other_gym')::uuid, 'member')).code, true);
select set_config('test.other_trainer_code', (create_gym_invite(current_setting('test.other_gym')::uuid, 'trainer')).code, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.other_trainer_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
do $$
begin
  perform accept_gym_invite(current_setting('test.other_code'));
  if (select gym_id from gym_members where status = 'active') <> current_setting('test.other_gym')::uuid
     or exists (select 1 from trainer_clients where status = 'active') then
    raise exception 'switching gyms should end the old membership and its trainer';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ee","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from gym_member_overview(current_setting('test.other_gym')::uuid) where trainer_id is not null) then
    raise exception 'another gym must not see the trainer Iron arranged';
  end if;
  perform offer_gym_trainer(current_setting('test.other_gym')::uuid, '00000000-0000-0000-0000-0000000090c2', '00000000-0000-0000-0000-0000000090b2');
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c2","role":"authenticated"}', true);
select respond_gym_trainer_offer((select offer_id from my_gym_trainer_offer()), true);

-- O removes Tomas from Iron: he stops training M1 there, keeps M2 at the other gym, and can't come
-- back on Iron's trainer link.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
do $$
begin
  if not end_gym_staff(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090b2', 'trainer') then
    raise exception 'the owner should be able to remove Tomas';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);
do $$
begin
  if is_trainer_of('00000000-0000-0000-0000-0000000090c1') then
    raise exception 'Tomas must lose M1 when he leaves Iron';
  end if;
  if not is_trainer_of('00000000-0000-0000-0000-0000000090c2') then
    raise exception 'leaving Iron must not end what the other gym arranged';
  end if;
  begin
    perform accept_gym_invite(current_setting('test.trainer_code'));
    raise exception 'a removed trainer must not rejoin on the same link' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;
end $$;

-- An open offer goes when the member leaves. The admin removes M3 (whose private trainer stays) and
-- steps down.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
select offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
do $$
begin
  if not end_gym_membership(current_setting('test.gym')::uuid, auth.uid()) then
    raise exception 'M1 should be able to leave';
  end if;
end $$;
do $$
begin
  if exists (select 1 from gym_members where status = 'active') or exists (select 1 from my_gym_trainer_offer()) then
    raise exception 'leaving should end M1''s membership and withdraw the open offer';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090ad","role":"authenticated"}', true);
do $$
begin
  if not end_gym_membership(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c3') then
    raise exception 'the admin should be able to remove M3';
  end if;
  if not end_gym_staff(current_setting('test.gym')::uuid, auth.uid(), 'admin') then
    raise exception 'an admin should be able to step down';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from trainer_clients where client_id = '00000000-0000-0000-0000-0000000090c3' and status = 'active' and gym_id is null) then
    raise exception 'M3''s private trainer should be untouched by leaving the gym';
  end if;
  if exists (select 1 from gym_staff where user_id = '00000000-0000-0000-0000-0000000090ad' and status = 'active') then
    raise exception 'the admin should have stepped down';
  end if;
  -- An admin stepping down leaves the gym's links alone.
  if not exists (select 1 from gym_invites where gym_id = current_setting('test.gym')::uuid and role = 'member' and revoked_at is null) then
    raise exception 'stepping down must not replace the gym''s links';
  end if;
end $$;

-- The owner deletes their account: the gym goes, and a trainer it arranged stays on as a private one.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
select accept_gym_invite(current_setting('test.member_code'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090a0","role":"authenticated"}', true);
select offer_gym_trainer(current_setting('test.gym')::uuid, '00000000-0000-0000-0000-0000000090c1', '00000000-0000-0000-0000-0000000090b1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090c1","role":"authenticated"}', true);
select respond_gym_trainer_offer((select offer_id from my_gym_trainer_offer()), true);
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
     or exists (select 1 from gym_staff where gym_id = current_setting('test.gym')::uuid)
     or exists (select 1 from gym_trainer_offers where gym_id = current_setting('test.gym')::uuid) then
    raise exception 'deleting the owner should delete the gym and its rows';
  end if;
  if not exists (
    select 1 from trainer_clients
    where client_id = '00000000-0000-0000-0000-0000000090c1' and trainer_id = '00000000-0000-0000-0000-0000000090b1'
      and status = 'active' and gym_id is null
  ) then
    raise exception 'the gym''s arranged link should carry on as a private one';
  end if;
end $$;

rollback;
