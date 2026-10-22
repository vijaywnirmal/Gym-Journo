-- Checks for migration 0033: signed-out (anon) requests can't call the write functions or read the
-- exercise library; signed-in people still can.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'save_workout_log(date, uuid, text, boolean, jsonb)',
    'save_workout_template(uuid, text, jsonb)',
    'apply_program(jsonb)',
    'decide_recommendation(uuid, text, numeric, numeric, text, text, jsonb, boolean)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'anon must not be able to execute %', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'signed-in people must still be able to execute %', fn;
    end if;
  end loop;
end $$;

insert into exercises (id, user_id, name) values ('00000000-0000-0000-0000-00000000d001', null, 'Zz Anon Check Lift');

set local role anon;
do $$
begin
  if exists (select 1 from exercises) then
    raise exception 'anon must not be able to read the exercise library';
  end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d0aa","role":"authenticated"}', true);
do $$
begin
  if not exists (select 1 from exercises where name = 'Zz Anon Check Lift') then
    raise exception 'signed-in people must still see the shared library';
  end if;
end $$;
reset role;

rollback;
