-- Checks for migration 0039: a trainer stops training clients. Their profile, client links and
-- invites go, their gym trainer role ends, an open suggestion of them goes, and the plans they made
-- stay with the client. Nobody else's trainer account changes, and it needs a signed-in trainer.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- T stops; T2 is another trainer; C is T's client, M a gym member T was suggested to; O owns a gym.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f0a1', 'stop-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000f0a2', 'other-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000f0c1', 'stop-client@example.test'),
  ('00000000-0000-0000-0000-00000000f0c2', 'stop-member@example.test'),
  ('00000000-0000-0000-0000-00000000f0a0', 'stop-owner@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000f0a1', true, 'Tess', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000f0a2', true, 'Tom', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000f0c1', true, 'Cara', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000f0c2', true, 'Mani', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000f0a0', true, 'Ola', 'Asia/Kolkata');
insert into trainer_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000f0a1', 'Tess'),
  ('00000000-0000-0000-0000-00000000f0a2', 'Tom');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000f0c1');
insert into trainer_invites (code, trainer_id, expires_at) values ('stoptest23', '00000000-0000-0000-0000-00000000f0a1', now() + interval '14 days');
insert into gyms (id, owner_id, name) values ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f0a0', 'Stop Gym');
insert into gym_staff (gym_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f0a1', 'trainer'),
  ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f0a2', 'trainer');
insert into gym_members (gym_id, user_id) values ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f0c2');
insert into gym_trainer_offers (gym_id, member_id, trainer_id) values
  ('00000000-0000-0000-0000-00000000f0f0', '00000000-0000-0000-0000-00000000f0c2', '00000000-0000-0000-0000-00000000f0a1');

-- T plans C's day (as T, so the plan records T as its author).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f0a1","role":"authenticated"}', true);
select save_client_plan('00000000-0000-0000-0000-00000000f0c1', current_date + 1, 'Legs from Tess', null, '{}', '[]');

-- Signed out, or not a trainer: refused.
set local role anon;
do $$
begin
  begin
    perform stop_training();
    raise exception 'anon must not stop training' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f0c1","role":"authenticated"}', true);
do $$
begin
  begin
    perform stop_training();
    raise exception 'a client must not stop training' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a trainer%' then raise; end if;
  end;
end $$;

-- T stops.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f0a1","role":"authenticated"}', true);
do $$
begin
  if stop_training() <> 1 then
    raise exception 'stopping should count the one client';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from trainer_profiles where user_id = '00000000-0000-0000-0000-00000000f0a1')
     or exists (select 1 from trainer_clients where trainer_id = '00000000-0000-0000-0000-00000000f0a1')
     or exists (select 1 from trainer_invites where trainer_id = '00000000-0000-0000-0000-00000000f0a1')
     or exists (select 1 from gym_trainer_offers where trainer_id = '00000000-0000-0000-0000-00000000f0a1') then
    raise exception 'stopping should remove the trainer profile, links, invites and open suggestions';
  end if;
  if exists (select 1 from gym_staff where user_id = '00000000-0000-0000-0000-00000000f0a1' and status = 'active') then
    raise exception 'stopping should end the trainer role at the gym';
  end if;
  if not exists (
    select 1 from workout_plans
    where user_id = '00000000-0000-0000-0000-00000000f0c1' and title = 'Legs from Tess'
      and created_by = '00000000-0000-0000-0000-00000000f0a1'
  ) then
    raise exception 'plans the trainer made should stay with the client';
  end if;
  if not exists (select 1 from trainer_profiles where user_id = '00000000-0000-0000-0000-00000000f0a2')
     or not exists (select 1 from gym_staff where user_id = '00000000-0000-0000-0000-00000000f0a2' and status = 'active') then
    raise exception 'another trainer must be untouched';
  end if;
  if not exists (select 1 from profiles where id = '00000000-0000-0000-0000-00000000f0a1' and onboarded) then
    raise exception 'the account itself stays';
  end if;
end $$;

rollback;
