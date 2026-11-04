-- Checks for migration 0046: one notification of a kind per person per gap, and nobody but the
-- server can touch it.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fb01', 'throttle-a@example.test'),
  ('00000000-0000-0000-0000-00000000fb02', 'throttle-b@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000fb01', true, 'Asha', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000fb02', true, 'Ben', 'Asia/Kolkata')
on conflict (id) do nothing;

set local role service_role;
do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000fb01';
  b constant uuid := '00000000-0000-0000-0000-00000000fb02';
begin
  if not claim_notification(a, 'trainer-plan', '10 minutes') then
    raise exception 'the first notification should go out';
  end if;
  if claim_notification(a, 'trainer-plan', '10 minutes') then
    raise exception 'a repeat within the gap should be held back';
  end if;
  if not claim_notification(a, 'trainer-plan-today', '10 minutes') then
    raise exception 'another kind of notification should still go out';
  end if;
  if not claim_notification(b, 'trainer-plan', '10 minutes') then
    raise exception 'another person''s notification should still go out';
  end if;
end $$;
reset role;

-- One after the gap goes out.
update notification_throttle set last_sent_at = now() - interval '11 minutes'
where user_id = '00000000-0000-0000-0000-00000000fb01' and topic = 'trainer-plan';
set local role service_role;
do $$
begin
  if not claim_notification('00000000-0000-0000-0000-00000000fb01', 'trainer-plan', '10 minutes') then
    raise exception 'a notification after the gap should go out';
  end if;
end $$;
reset role;

-- Signed-in people can neither use the function nor see the table.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000fb01","role":"authenticated"}', true);
do $$
begin
  begin
    perform claim_notification('00000000-0000-0000-0000-00000000fb02', 'trainer-plan', '0 minutes');
    raise exception 'a signed-in person should not be able to claim';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from notification_throttle;
    raise exception 'a signed-in person should not be able to read the table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
