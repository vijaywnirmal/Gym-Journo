-- Checks for migration 0050: someone not signed in sees who sent a working invite link (a trainer's
-- name, gym and city; a gym's name, area and city), nothing for a dead or unknown one, and never a
-- phone number.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fd01', 'preview-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000fd02', 'preview-owner@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000fd01', true, 'Ravi', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000fd02', true, 'Ola', 'Asia/Kolkata')
on conflict (id) do nothing;
insert into trainer_profiles (user_id, display_name, gym_name, city, whatsapp) values
  ('00000000-0000-0000-0000-00000000fd01', 'Ravi Kumar', 'Iron House', 'Pune', '+919876543210');
insert into gyms (id, owner_id, name, city, area, phone) values
  ('00000000-0000-0000-0000-00000000fdf0', '00000000-0000-0000-0000-00000000fd02', 'Preview Gym', 'Pune', 'Baner', '+919800000000');
insert into trainer_invites (code, trainer_id, expires_at, revoked_at) values
  ('prvopen001', '00000000-0000-0000-0000-00000000fd01', now() + interval '14 days', null),
  ('prvlate001', '00000000-0000-0000-0000-00000000fd01', now() - interval '1 day', null);
insert into gym_invites (code, gym_id, role, expires_at, revoked_at) values
  ('prvgym0001', '00000000-0000-0000-0000-00000000fdf0', 'member', null, null),
  ('prvgymtr01', '00000000-0000-0000-0000-00000000fdf0', 'trainer', now() + interval '14 days', null),
  ('prvgymgone', '00000000-0000-0000-0000-00000000fdf0', 'admin', now() + interval '14 days', now());

set local role anon;
do $$
declare
  r record;
begin
  select * into r from invite_preview('trainer', ' PRVOPEN001 ');
  if (r.state, r.role, r.name, r.gym_name, r.city, r.area) is distinct from ('open'::text, 'trainer'::text, 'Ravi Kumar'::text, 'Iron House'::text, 'Pune'::text, null::text) then
    raise exception 'an open trainer link should show the trainer''s name, gym and city, got %', r;
  end if;

  select * into r from invite_preview('gym', 'prvgym0001');
  if (r.state, r.role, r.name, r.gym_name, r.city, r.area) is distinct from ('open'::text, 'member'::text, 'Preview Gym'::text, null::text, 'Pune'::text, 'Baner'::text) then
    raise exception 'an open gym link should show the gym''s name, city and area, got %', r;
  end if;

  select * into r from invite_preview('gym', 'prvgymtr01');
  if r.role is distinct from 'trainer' then
    raise exception 'a gym''s trainer link should say it''s for a trainer, got %', r;
  end if;

  -- Dead or unknown links say so, and nothing else.
  select * into r from invite_preview('trainer', 'prvlate001');
  if (r.state, r.role, r.name, r.gym_name, r.city, r.area) is distinct from ('expired'::text, null::text, null::text, null::text, null::text, null::text) then
    raise exception 'an expired link should show no details, got %', r;
  end if;
  select * into r from invite_preview('gym', 'prvgymgone');
  if (r.state, r.role, r.name, r.gym_name, r.city, r.area) is distinct from ('expired'::text, null::text, null::text, null::text, null::text, null::text) then
    raise exception 'a revoked link should show no details, got %', r;
  end if;
  select * into r from invite_preview('trainer', 'zzzzzzzzzz');
  if (r.state, r.role, r.name, r.gym_name, r.city, r.area) is distinct from ('not_found'::text, null::text, null::text, null::text, null::text, null::text) then
    raise exception 'an unknown link should be not_found, got %', r;
  end if;
  -- A code only counts for its own kind of link.
  select * into r from invite_preview('gym', 'prvopen001');
  if r.state is distinct from 'not_found' then
    raise exception 'a trainer code should not work as a gym link, got %', r;
  end if;
  if (select count(*) from invite_preview('trainer', 'prvopen001')) <> 1 then
    raise exception 'a preview should be one row';
  end if;

  -- Phone numbers never come back, whatever the column.
  if exists (
    select 1 from invite_preview('trainer', 'prvopen001') p
    where concat_ws(' ', p.name, p.gym_name, p.city, p.area) like '%98%'
  ) or exists (
    select 1 from invite_preview('gym', 'prvgym0001') p
    where concat_ws(' ', p.name, p.gym_name, p.city, p.area) like '%98%'
  ) then
    raise exception 'a preview should never include a phone number';
  end if;
end $$;
reset role;

-- Signed-in people get the full invite pages instead.
set local role authenticated;
do $$
begin
  begin
    perform invite_preview('trainer', 'prvopen001');
    raise exception 'invite_preview should be for signed-out visitors only';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
