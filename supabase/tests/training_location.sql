-- Checks for migration 0041: profiles.training_location takes the three answers or nothing, and
-- people can only set their own.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e101', 'location-a@example.test'),
  ('00000000-0000-0000-0000-00000000e102', 'location-b@example.test');
insert into profiles (id, onboarded) values
  ('00000000-0000-0000-0000-00000000e101', true),
  ('00000000-0000-0000-0000-00000000e102', true);

do $$
declare
  answer text;
begin
  foreach answer in array array['gym', 'home_dumbbells', 'bodyweight'] loop
    update profiles set training_location = answer where id = '00000000-0000-0000-0000-00000000e101';
  end loop;
  update profiles set training_location = null where id = '00000000-0000-0000-0000-00000000e101';

  begin
    update profiles set training_location = 'moon' where id = '00000000-0000-0000-0000-00000000e101';
    raise exception 'training_location must reject an unknown answer';
  exception when check_violation then
    null;
  end;
end $$;

-- Signed in as person A: they can set their own answer, and can't touch person B's.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000e101", "role": "authenticated"}', true);

update profiles set training_location = 'gym' where id = '00000000-0000-0000-0000-00000000e101';
update profiles set training_location = 'gym' where id = '00000000-0000-0000-0000-00000000e102';
reset role;

do $$
begin
  if (select training_location from profiles where id = '00000000-0000-0000-0000-00000000e101') is distinct from 'gym' then
    raise exception 'a person must be able to set their own training location';
  end if;
  if (select training_location from profiles where id = '00000000-0000-0000-0000-00000000e102') is not null then
    raise exception 'a person must not be able to set someone else''s training location';
  end if;
end $$;

rollback;
