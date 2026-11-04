-- Checks for migration 0049: Profile can tell someone their gym or trainer ended them, and only them.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fd01', 'rm-owner@example.test'),
  ('00000000-0000-0000-0000-00000000fd02', 'rm-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000fd03', 'rm-member@example.test'),
  ('00000000-0000-0000-0000-00000000fd04', 'rm-other@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000fd01', true, 'Ola', 'UTC'),
  ('00000000-0000-0000-0000-00000000fd02', true, 'Tess', 'UTC'),
  ('00000000-0000-0000-0000-00000000fd03', true, 'Mia', 'UTC'),
  ('00000000-0000-0000-0000-00000000fd04', true, 'Omar', 'UTC')
on conflict (id) do nothing;
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000fd02', 'Tess');
insert into gyms (id, owner_id, name) values
  ('00000000-0000-0000-0000-00000000fdf0', '00000000-0000-0000-0000-00000000fd01', 'Removal Gym');
insert into gym_members (id, gym_id, user_id, status, started_at, ended_at, ended_by) values
  ('00000000-0000-0000-0000-00000000fda1', '00000000-0000-0000-0000-00000000fdf0', '00000000-0000-0000-0000-00000000fd03',
   'ended', now() - interval '30 days', now() - interval '2 days', '00000000-0000-0000-0000-00000000fd01');
insert into trainer_clients (id, trainer_id, client_id, status, started_at, ended_at, ended_by, gym_id) values
  ('00000000-0000-0000-0000-00000000fdb1', '00000000-0000-0000-0000-00000000fd02', '00000000-0000-0000-0000-00000000fd03',
   'ended', now() - interval '30 days', now() - interval '2 days', '00000000-0000-0000-0000-00000000fd01',
   '00000000-0000-0000-0000-00000000fdf0');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.answers() returns text language sql as $$
  select coalesce(string_agg(kind || ':' || name, ',' order by kind), '') from my_recent_removals();
$$;

set local role authenticated;
do $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd03');
  if pg_temp.answers() <> 'gym:Removal Gym,trainer:Tess' then
    raise exception 'the member should hear about both, got %', pg_temp.answers();
  end if;

  -- Nobody else hears about it, including those who did it.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd04');
  if pg_temp.answers() <> '' then raise exception 'someone else got %', pg_temp.answers(); end if;
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd01');
  if pg_temp.answers() <> '' then raise exception 'the owner got %', pg_temp.answers(); end if;
end $$;
reset role;

-- Their own decision isn't news.
update gym_members set ended_by = '00000000-0000-0000-0000-00000000fd03'
where id = '00000000-0000-0000-0000-00000000fda1';
set local role authenticated;
do $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd03');
  if pg_temp.answers() <> 'trainer:Tess' then
    raise exception 'leaving yourself should not count, got %', pg_temp.answers();
  end if;
end $$;
reset role;

-- A trainer who has since been replaced isn't either.
insert into trainer_clients (trainer_id, client_id, started_at) values
  ('00000000-0000-0000-0000-00000000fd02', '00000000-0000-0000-0000-00000000fd03', now() - interval '1 day');
set local role authenticated;
do $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd03');
  if pg_temp.answers() <> '' then
    raise exception 'starting again should clear it, got %', pg_temp.answers();
  end if;
end $$;
reset role;

-- Nor is something that ended over two weeks ago.
delete from trainer_clients where client_id = '00000000-0000-0000-0000-00000000fd03' and status = 'active';
update trainer_clients set ended_at = now() - interval '15 days'
where id = '00000000-0000-0000-0000-00000000fdb1';
set local role authenticated;
do $$
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000fd03');
  if pg_temp.answers() <> '' then
    raise exception 'an old removal should have gone, got %', pg_temp.answers();
  end if;
end $$;
reset role;

-- Someone signed out can't ask.
set local role anon;
do $$
begin
  perform my_recent_removals();
  raise exception 'someone signed out should not be able to ask';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;
