-- Checks for migration 0034 (trainers): a trainer sees and plans a client's data only while the
-- client has accepted them, never another trainer's clients, never the fields that stay private,
-- and nobody can create a link or a plan for someone else.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- T and T2 are trainers; C is T's client-to-be, C2 is T2's; X is anyone else; N hasn't finished
-- onboarding.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'trainer-t@example.test'),
  ('00000000-0000-0000-0000-00000000a002', 'trainer-t2@example.test'),
  ('00000000-0000-0000-0000-00000000c001', 'client-c@example.test'),
  ('00000000-0000-0000-0000-00000000c002', 'client-c2@example.test'),
  ('00000000-0000-0000-0000-00000000e001', 'other-x@example.test'),
  ('00000000-0000-0000-0000-00000000e002', 'new-n@example.test');

insert into profiles (id, onboarded, first_name, last_name, primary_goal, experience_level,
  training_days_per_week, timezone, date_of_birth, height_cm, gender) values
  ('00000000-0000-0000-0000-00000000a001', true, 'Ravi', null, null, null, null, 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-00000000a002', true, 'Asha', null, null, null, null, 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-00000000c001', true, 'Priya', 'S', 'build_muscle', 'beginner', 3, 'Asia/Kolkata', '1995-04-01', 160, 'female'),
  ('00000000-0000-0000-0000-00000000c002', true, 'Kiran', null, 'lose_fat', 'beginner', 4, 'Asia/Kolkata', null, null, null),
  ('00000000-0000-0000-0000-00000000e001', true, 'Xavier', null, null, null, null, null, null, null, null),
  ('00000000-0000-0000-0000-00000000e002', false, null, null, null, null, null, null, null, null, null);

insert into muscle_groups (id, name) values ('00000000-0000-0000-0000-0000000000f1', 'Trainer Test Legs');
insert into exercises (id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', null, 'Trainer Test Squat'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000c001', 'Priya Custom Lunge'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000a001', 'Ravi Custom Press');

-- C's own history: today's performed workout and two body weights (one with a private note).
insert into workout_logs (id, user_id, date, notes) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000c001',
   (now() at time zone 'Asia/Kolkata')::date, 'Knee felt fine');
insert into logged_exercises (id, log_id, exercise_id, position) values
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000d2', 0);
insert into logged_sets (logged_exercise_id, set_number, reps, weight) values
  ('00000000-0000-0000-0000-0000000001b1', 1, 10, 20);
insert into body_measurements (user_id, date, weight_kg, notes) values
  ('00000000-0000-0000-0000-00000000c001', (now() at time zone 'Asia/Kolkata')::date - 7, 61, 'private note'),
  ('00000000-0000-0000-0000-00000000c001', (now() at time zone 'Asia/Kolkata')::date - 1, 60.5, null);

-- Signed out: no trainer tables, no trainer functions.
set local role anon;
do $$
begin
  begin
    perform 1 from trainer_profiles;
    raise exception 'anon must not read trainer_profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform trainer_invite_details('abcdefghjk');
    raise exception 'anon must not call trainer_invite_details';
  exception when insufficient_privilege then null;
  end;
  begin
    perform accept_trainer_invite('abcdefghjk');
    raise exception 'anon must not call accept_trainer_invite';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Internal helpers can't be called directly by anyone signed in.
do $$
begin
  if has_function_privilege('authenticated', 'require_trainer_of(uuid)', 'execute')
     or has_function_privilege('authenticated', 'require_client_exercises(uuid, uuid[])', 'execute') then
    raise exception 'internal helpers must not be callable by authenticated';
  end if;
end $$;

-- T and T2 become trainers (through row-level security, as the app will do it).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
insert into trainer_profiles (user_id, display_name, gym_name, city, whatsapp)
  values ('00000000-0000-0000-0000-00000000a001', 'Ravi', 'Iron Gym', 'Pune', '+919876543210');
do $$
begin
  begin
    insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000e001', 'Fake');
    raise exception 'T must not create a trainer profile for X';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000a001', 'Twice');
    raise exception 'T must not have two trainer profiles';
  exception when unique_violation then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
insert into trainer_profiles (user_id, display_name, gym_name, city)
  values ('00000000-0000-0000-0000-00000000a002', 'Asha', 'Core Fitness', 'Pune');
select set_config('test.t2_code', (select code from create_trainer_invite()), true);

-- X isn't a trainer, so has no invite to make.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}', true);
do $$
begin
  begin
    perform create_trainer_invite();
    raise exception 'X is not a trainer and must not create an invite';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T, before anyone accepts: no access to C at all.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
do $$
declare
  v_first text;
  v_second text;
begin
  if exists (select 1 from trainer_client_overview()) then
    raise exception 'T should have no clients before an invite is accepted';
  end if;
  begin
    perform client_plans('00000000-0000-0000-0000-00000000c001', current_date - 7, current_date);
    raise exception 'T must not read C''s plans before C accepts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform save_client_plan('00000000-0000-0000-0000-00000000c001', current_date, 'Legs', null, '{}', '[]');
    raise exception 'T must not plan for C before C accepts';
  exception when insufficient_privilege then null;
  end;

  -- A new link replaces the old one.
  v_first := (select code from create_trainer_invite());
  v_second := (select code from create_trainer_invite());
  if v_first !~ '^[a-z0-9]{10}$' or v_first = v_second then
    raise exception 'invite codes should be 10 lowercase letters or digits, new each time';
  end if;
  if (select count(*) from trainer_invites where revoked_at is null) <> 1 then
    raise exception 'only the newest invite link should still work';
  end if;
  perform set_config('test.old_code', v_first, true);
  perform set_config('test.code', v_second, true);

  if (select state from trainer_invite_details(v_second)) <> 'own' then
    raise exception 'T opening their own link should see state own';
  end if;
  begin
    perform accept_trainer_invite(v_second);
    raise exception 'T must not accept their own invite';
  exception when raise_exception then
    if sqlerrm not like '%own invite%' then raise; end if;
  end;
end $$;

-- N hasn't finished onboarding (where people confirm they're 18 or older), so can't accept.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated"}', true);
do $$
begin
  begin
    perform accept_trainer_invite(current_setting('test.code'));
    raise exception 'N must finish onboarding before accepting';
  exception when raise_exception then
    if sqlerrm not like '%Finish setting up%' then raise; end if;
  end;
end $$;

-- C checks the link, then accepts. Accepting again changes nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
do $$
declare
  v_details record;
  v_link trainer_clients;
  v_again trainer_clients;
begin
  if exists (select 1 from trainer_profiles) then
    raise exception 'C should not see any trainer profile before accepting';
  end if;
  if (select state from trainer_invite_details(current_setting('test.old_code'))) <> 'expired' then
    raise exception 'a replaced link should read as expired';
  end if;
  if (select state from trainer_invite_details('zzzzzzzzzz')) <> 'not_found' then
    raise exception 'an unknown code should read as not_found';
  end if;
  begin
    perform accept_trainer_invite(current_setting('test.old_code'));
    raise exception 'C must not accept a replaced link';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;

  select * into v_details from trainer_invite_details(upper(current_setting('test.code')));
  if v_details.state <> 'valid' or v_details.display_name <> 'Ravi' or v_details.gym_name <> 'Iron Gym' then
    raise exception 'the join page should show a valid link with T''s name and gym, got %', row_to_json(v_details);
  end if;

  v_link := accept_trainer_invite(current_setting('test.code'));
  v_again := accept_trainer_invite(current_setting('test.code'));
  if v_link.trainer_id <> '00000000-0000-0000-0000-00000000a001' or v_link.status <> 'active' or v_again.id <> v_link.id then
    raise exception 'accepting should create one active link with T, and accepting again should return it';
  end if;
  if (select state from trainer_invite_details(current_setting('test.code'))) <> 'current' then
    raise exception 'C opening T''s link again should see state current';
  end if;
  perform set_config('test.link', v_link.id::text, true);

  -- The "Your trainer" card.
  if (select count(*) from trainer_profiles) <> 1 or (select whatsapp from trainer_profiles) <> '+919876543210' then
    raise exception 'C should see exactly T''s trainer profile';
  end if;

  -- No direct writes to links or invites.
  begin
    insert into trainer_clients (trainer_id, client_id) values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000c002');
    raise exception 'C must not insert links directly';
  exception when insufficient_privilege then null;
  end;
  update trainer_clients set status = 'ended', ended_at = now();
  delete from trainer_clients;
  if (select count(*) from trainer_clients where status = 'active') <> 1 then
    raise exception 'C must not change or delete links directly';
  end if;

  -- C is not a trainer, so can't plan for anyone.
  begin
    perform save_client_plan('00000000-0000-0000-0000-00000000c002', current_date, 'x', null, '{}', '[]');
    raise exception 'C must not plan for C2';
  exception when insufficient_privilege then null;
  end;
end $$;

-- X: not linked, so sees nothing of T's.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from trainer_profiles) or exists (select 1 from trainer_clients) or exists (select 1 from trainer_invites) then
    raise exception 'X should see no trainer profiles, links or invites';
  end if;
end $$;

-- C2 accepts T2.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}', true);
select accept_trainer_invite(current_setting('test.t2_code'));

-- T, now C's trainer.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
do $$
declare
  v_row record;
  v_plan workout_plans;
  v_plans jsonb;
  v_logs jsonb;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if (select count(*) from trainer_client_overview()) <> 1 then
    raise exception 'T should have exactly one client';
  end if;
  select * into v_row from trainer_client_overview();
  if v_row.client_id <> '00000000-0000-0000-0000-00000000c001' or v_row.first_name <> 'Priya'
     or v_row.primary_goal <> 'build_muscle' or v_row.training_days_per_week <> 3
     or v_row.client_today <> v_today or not v_row.today_done or v_row.today_plan is not null
     or v_row.done_this_week <> 1 or v_row.last_workout_on <> v_today
     or v_row.latest_weight_kg <> 60.5 or v_row.latest_weight_on <> v_today - 1 then
    raise exception 'overview is wrong: %', row_to_json(v_row);
  end if;
  -- Only the agreed fields: nothing like date of birth, height, gender or email.
  if exists (
    select 1 from jsonb_object_keys(to_jsonb(v_row)) as k
    where k ~ '(birth|height|gender|email|timezone|coach|reminder)'
  ) then
    raise exception 'overview must not expose private profile fields';
  end if;

  -- Row-level security is unchanged: T's own queries still see only T's rows.
  if exists (select 1 from workout_logs) or exists (select 1 from body_measurements)
     or exists (select 1 from profiles where id <> auth.uid())
     or exists (select 1 from exercises where user_id = '00000000-0000-0000-0000-00000000c001') then
    raise exception 'T''s own queries must not include C''s rows';
  end if;

  -- Plans: the shared library and C's own exercises are fine; T's custom exercise isn't, since C
  -- couldn't see it.
  v_plan := save_client_plan('00000000-0000-0000-0000-00000000c001', v_today + 1, 'Legs', null,
    array['00000000-0000-0000-0000-0000000000f1']::uuid[],
    '[{"exercise_id":"00000000-0000-0000-0000-0000000000d1","position":0,"target_sets":3,"target_reps":8},
      {"exercise_id":"00000000-0000-0000-0000-0000000000d2","position":1,"target_sets":3,"target_reps":12,"target_weight":20}]');
  if v_plan.user_id <> '00000000-0000-0000-0000-00000000c001' or v_plan.created_by <> auth.uid() or v_plan.updated_by <> auth.uid() then
    raise exception 'T''s plan should belong to C, made and last changed by T';
  end if;
  begin
    perform save_client_plan('00000000-0000-0000-0000-00000000c001', v_today + 2, 'Press', null, '{}',
      '[{"exercise_id":"00000000-0000-0000-0000-0000000000d3","position":0}]');
    raise exception 'T must not put T''s own custom exercise in C''s plan';
  exception when raise_exception then
    if sqlerrm not like '%Unknown exercise%' then raise; end if;
  end;
  -- Rest day marked for yesterday: late, judged in C's time zone.
  v_plan := save_client_plan('00000000-0000-0000-0000-00000000c001', v_today - 1, null, 'rest', '{}', '[]');
  if not v_plan.off_marked_late then
    raise exception 'a day off marked after the fact should be off_marked_late';
  end if;

  if apply_program_for_client('00000000-0000-0000-0000-00000000c001',
       jsonb_build_array(
         jsonb_build_object('date', v_today + 1, 'title', 'Should be skipped', 'exercises', '[]'::jsonb),
         jsonb_build_object('date', v_today + 3, 'title', 'Full body', 'muscle_group_ids', '["00000000-0000-0000-0000-0000000000f1"]'::jsonb,
           'exercises', '[{"exercise_id":"00000000-0000-0000-0000-0000000000d1","position":0,"target_sets":3}]'::jsonb))) <> 1 then
    raise exception 'apply_program_for_client should create only the free day';
  end if;

  v_plans := client_plans('00000000-0000-0000-0000-00000000c001', v_today - 7, v_today + 7);
  if jsonb_array_length(v_plans) <> 3
     or v_plans -> 1 ->> 'title' <> 'Legs'
     or v_plans -> 1 -> 'exercises' -> 1 ->> 'name' <> 'Priya Custom Lunge'
     or (v_plans -> 1 -> 'exercises' -> 1 ->> 'target_weight')::numeric <> 20
     or v_plans -> 1 -> 'muscle_group_ids' ->> 0 <> '00000000-0000-0000-0000-0000000000f1' then
    raise exception 'client_plans is wrong: %', v_plans;
  end if;

  v_logs := client_logs('00000000-0000-0000-0000-00000000c001', v_today - 7, v_today);
  if jsonb_array_length(v_logs) <> 1 or v_logs -> 0 ->> 'notes' <> 'Knee felt fine'
     or v_logs -> 0 -> 'exercises' -> 0 ->> 'name' <> 'Priya Custom Lunge'
     or (v_logs -> 0 -> 'exercises' -> 0 -> 'sets' -> 0 ->> 'reps')::int <> 10 then
    raise exception 'client_logs is wrong: %', v_logs;
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-00000000c001', v_today - 365, v_today);
    raise exception 'a range over 120 days should be refused';
  exception when raise_exception then
    if sqlerrm not like '%120 days%' then raise; end if;
  end;

  if (select count(*) from client_body_weights('00000000-0000-0000-0000-00000000c001', v_today - 30, v_today)) <> 2 then
    raise exception 'T should see C''s two body weights';
  end if;
  if (select count(*) from client_custom_exercises('00000000-0000-0000-0000-00000000c001')) <> 1 then
    raise exception 'T should see C''s one custom exercise';
  end if;

  -- Another trainer's client: nothing.
  begin
    perform client_plans('00000000-0000-0000-0000-00000000c002', v_today - 7, v_today);
    raise exception 'T must not read C2''s plans';
  exception when insufficient_privilege then null;
  end;
  begin
    perform save_client_plan('00000000-0000-0000-0000-00000000c002', v_today, 'x', null, '{}', '[]');
    raise exception 'T must not plan for C2';
  exception when insufficient_privilege then null;
  end;
  begin
    perform client_body_weights('00000000-0000-0000-0000-00000000c002', v_today - 7, v_today);
    raise exception 'T must not read C2''s body weight';
  exception when insufficient_privilege then null;
  end;
  if end_trainer_link((select id from trainer_clients where client_id = '00000000-0000-0000-0000-00000000c002' limit 1)) then
    raise exception 'T must not end T2''s link';
  end if;
  if (select count(*) from trainer_clients) <> 1 then
    raise exception 'T should see only T''s own link';
  end if;
end $$;

-- C edits T's plan: C becomes the last editor, T stays the author. C can't forge the author.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
do $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_plan workout_plans;
begin
  v_plan := save_workout_plan(v_today + 1, 'Legs, lighter', null, '{}', '[]');
  if v_plan.created_by <> '00000000-0000-0000-0000-00000000a001' or v_plan.updated_by <> auth.uid() then
    raise exception 'C''s edit should keep T as author and record C as last editor';
  end if;
  insert into workout_plans (user_id, date, title, is_rest_day, created_by, updated_by)
    values (auth.uid(), v_today + 5, 'Mine', false, '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a001')
    returning * into v_plan;
  if v_plan.created_by <> auth.uid() or v_plan.updated_by <> auth.uid() then
    raise exception 'authors must come from the session, not the request';
  end if;
  update workout_plans set created_by = '00000000-0000-0000-0000-00000000a002' where id = v_plan.id;
  if (select created_by from workout_plans where id = v_plan.id) <> auth.uid() then
    raise exception 'the author must not be changeable';
  end if;

  -- C switches to T2: the link with T ends (C ended it), and the new one starts.
  perform accept_trainer_invite(current_setting('test.t2_code'));
  if exists (select 1 from trainer_clients where trainer_id = '00000000-0000-0000-0000-00000000a001' and status = 'active')
     or (select ended_by from trainer_clients where trainer_id = '00000000-0000-0000-0000-00000000a001') <> auth.uid()
     or (select count(*) from trainer_clients where status = 'active' and trainer_id = '00000000-0000-0000-0000-00000000a002') <> 1 then
    raise exception 'accepting T2 should end the link with T and start one with T2';
  end if;
  if (select display_name from trainer_profiles) <> 'Asha' then
    raise exception 'C should now see only T2''s trainer profile';
  end if;
end $$;

-- T, after C left: nothing, though the plans T made stay with C.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from trainer_client_overview()) then
    raise exception 'T should have no clients after C left';
  end if;
  begin
    perform client_logs('00000000-0000-0000-0000-00000000c001', current_date - 7, current_date);
    raise exception 'T must not read C''s logs after C left';
  exception when insufficient_privilege then null;
  end;
  begin
    perform delete_client_plan('00000000-0000-0000-0000-00000000c001', current_date);
    raise exception 'T must not delete C''s plans after C left';
  exception when insufficient_privilege then null;
  end;
  begin
    perform apply_program_for_client('00000000-0000-0000-0000-00000000c001', '[]');
    raise exception 'T must not apply a program for C after C left';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T2 ends the link with C.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
do $$
declare
  v_link uuid := (select id from trainer_clients where client_id = '00000000-0000-0000-0000-00000000c001' and status = 'active');
begin
  if (select count(*) from trainer_client_overview()) <> 2 then
    raise exception 'T2 should have C and C2';
  end if;
  if not delete_client_plan('00000000-0000-0000-0000-00000000c001', ((now() at time zone 'Asia/Kolkata')::date + 3)) then
    raise exception 'T2 should be able to remove a planned day of C''s';
  end if;
  if not end_trainer_link(v_link) or end_trainer_link(v_link) then
    raise exception 'T2 should end the link once';
  end if;
  begin
    perform client_plans('00000000-0000-0000-0000-00000000c001', current_date - 7, current_date);
    raise exception 'T2 must not read C''s plans after ending the link';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- An expired link can't be used.
update trainer_invites set expires_at = now() - interval '1 minute' where code = current_setting('test.t2_code');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated"}', true);
do $$
begin
  if (select state from trainer_invite_details(current_setting('test.t2_code'))) <> 'expired' then
    raise exception 'an expired link should read as expired';
  end if;
  begin
    perform accept_trainer_invite(current_setting('test.t2_code'));
    raise exception 'X must not accept an expired link';
  exception when raise_exception then
    if sqlerrm not like '%expired%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if (select count(*) from workout_plans where user_id = '00000000-0000-0000-0000-00000000c001'
        and created_by = '00000000-0000-0000-0000-00000000a001') <> 2 then
    raise exception 'plans T made should stay with C after the link ended';
  end if;
end $$;

rollback;
