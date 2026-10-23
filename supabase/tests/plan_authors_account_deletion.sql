-- Checks for migration 0035: deleting an account clears it from the plans it made for others
-- (workout_plans.created_by / updated_by, ON DELETE SET NULL), and the author stamp can't be
-- cleared any other way.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000da001', 'deleting-trainer@example.test'),
  ('00000000-0000-0000-0000-0000000dc001', 'deleting-client@example.test');
insert into profiles (id, onboarded, timezone) values
  ('00000000-0000-0000-0000-0000000dc001', true, 'Asia/Kolkata');
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000da001', 'T');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-0000000da001', '00000000-0000-0000-0000-0000000dc001');

-- The trainer plans two days for the client; the client edits one of them.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000da001","role":"authenticated"}', true);
select save_client_plan('00000000-0000-0000-0000-0000000dc001', '2030-01-07', 'Legs', null, '{}', '[]');
select save_client_plan('00000000-0000-0000-0000-0000000dc001', '2030-01-08', 'Push', null, '{}', '[]');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000dc001","role":"authenticated"}', true);
select save_workout_plan('2030-01-08', 'Push, lighter', null, '{}', '[]');

-- A plan saved with no session (as before 0034, or by the service role) has no authors; the people
-- who edit it later are still recorded.
reset role;
select set_config('request.jwt.claims', '', true);
insert into workout_plans (user_id, date, title, is_rest_day) values ('00000000-0000-0000-0000-0000000dc001', '2030-01-09', 'Old', false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000dc001","role":"authenticated"}', true);
select save_workout_plan('2030-01-09', 'Old, edited by the client', null, '{}', '[]');
do $$
begin
  if (select updated_by from workout_plans where date = '2030-01-09') is distinct from '00000000-0000-0000-0000-0000000dc001' then
    raise exception 'an edit to a plan with no recorded author should record the editor';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000da001","role":"authenticated"}', true);
select save_client_plan('00000000-0000-0000-0000-0000000dc001', '2030-01-09', 'Old, changed by the trainer', null, '{}', '[]');
-- Checked as the owner: the trainer can't read the client's plans directly.
reset role;
do $$
begin
  if (select updated_by from workout_plans where date = '2030-01-09') is distinct from '00000000-0000-0000-0000-0000000da001'
     or (select created_by from workout_plans where date = '2030-01-09') is not null then
    raise exception 'the trainer''s edit should be recorded, and the unknown author stay unknown';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000dc001","role":"authenticated"}', true);

do $$
begin
  -- The client can't wipe the trainer's authorship by hand.
  update workout_plans set created_by = null, updated_by = null where date = '2030-01-07';
  if (select created_by from workout_plans where date = '2030-01-07') is null
     or (select updated_by from workout_plans where date = '2030-01-07') is null then
    raise exception 'the author stamp must not be clearable by an update';
  end if;
end $$;
reset role;

-- The trainer deletes their account (as the auth service does: no session).
select set_config('request.jwt.claims', '', true);
delete from auth.users where id = '00000000-0000-0000-0000-0000000da001';

do $$
begin
  if exists (select 1 from workout_plans where created_by = '00000000-0000-0000-0000-0000000da001'
                or updated_by = '00000000-0000-0000-0000-0000000da001') then
    raise exception 'the deleted trainer should be cleared from the plans they made';
  end if;
  if (select count(*) from workout_plans where user_id = '00000000-0000-0000-0000-0000000dc001') <> 3 then
    raise exception 'the client should keep all three plans';
  end if;
  if (select updated_by from workout_plans where date = '2030-01-08') <> '00000000-0000-0000-0000-0000000dc001' then
    raise exception 'the client''s own edit should still be recorded';
  end if;
end $$;

rollback;
