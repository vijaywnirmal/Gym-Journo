-- Checks for migration 0048: someone not signed in can learn whether an invite link still works,
-- and nothing else.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fc01', 'link-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000fc02', 'link-owner@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000fc01', true, 'Tess', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000fc02', true, 'Ola', 'Asia/Kolkata')
on conflict (id) do nothing;
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000fc01', 'Tess');
insert into gyms (id, owner_id, name) values
  ('00000000-0000-0000-0000-00000000fcf0', '00000000-0000-0000-0000-00000000fc02', 'Link Gym');
insert into trainer_invites (code, trainer_id, expires_at, revoked_at) values
  ('tropen0001', '00000000-0000-0000-0000-00000000fc01', now() + interval '14 days', null),
  ('trlate0001', '00000000-0000-0000-0000-00000000fc01', now() - interval '1 day', null),
  ('trgone0001', '00000000-0000-0000-0000-00000000fc01', now() + interval '14 days', now());
insert into gym_invites (code, gym_id, role, expires_at, revoked_at) values
  ('gymopen001', '00000000-0000-0000-0000-00000000fcf0', 'member', null, null),
  ('gymlate001', '00000000-0000-0000-0000-00000000fcf0', 'trainer', now() - interval '1 day', null),
  ('gymused001', '00000000-0000-0000-0000-00000000fcf0', 'admin', now() + interval '14 days', now());

set local role anon;
do $$
declare
  v_check record;
begin
  for v_check in
    select * from (values
      ('trainer', 'tropen0001', 'open'),
      ('trainer', ' TROPEN0001 ', 'open'),
      ('trainer', 'trlate0001', 'expired'),
      ('trainer', 'trgone0001', 'expired'),
      ('trainer', 'zzzzzzzzzz', 'not_found'),
      ('gym', 'gymopen001', 'open'),
      ('gym', 'gymlate001', 'expired'),
      ('gym', 'gymused001', 'expired'),
      ('gym', 'zzzzzzzzzz', 'not_found'),
      -- A code only counts for its own kind of link.
      ('gym', 'tropen0001', 'not_found'),
      ('trainer', 'gymopen001', 'not_found'),
      ('other', 'tropen0001', 'not_found')
    ) as t(kind, code, expected)
  loop
    if invite_link_state(v_check.kind, v_check.code) is distinct from v_check.expected then
      raise exception 'invite_link_state(%, %) should be %, got %',
        v_check.kind, v_check.code, v_check.expected, invite_link_state(v_check.kind, v_check.code);
    end if;
  end loop;

  -- The answer is all they get.
  begin
    perform 1 from trainer_invites;
    raise exception 'someone signed out should not be able to read trainer links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from gym_invites;
    raise exception 'someone signed out should not be able to read gym links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform trainer_invite_details('tropen0001');
    raise exception 'someone signed out should not get a trainer''s details';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'someone signed out%' then raise; end if;
  end;
end $$;
reset role;

rollback;
