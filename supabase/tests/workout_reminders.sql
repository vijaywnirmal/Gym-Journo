-- Checks for migration 0030 (workout reminders): who due_workout_reminders picks, device
-- registration, and access rules — against a real database.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'remind-a@example.test'),
  ('00000000-0000-0000-0000-00000000b002', 'remind-b@example.test'),
  ('00000000-0000-0000-0000-00000000c003', 'remind-c@example.test');

-- A: UTC, reminders at 18:00. B: India (UTC+5:30), reminders at 07:00. C: reminders off.
insert into profiles (id, onboarded, timezone, workout_reminders, reminder_time) values
  ('00000000-0000-0000-0000-00000000a001', true, 'UTC', true, '18:00'),
  ('00000000-0000-0000-0000-00000000b002', true, 'Asia/Kolkata', true, '07:00'),
  ('00000000-0000-0000-0000-00000000c003', true, 'UTC', false, '18:00');

insert into push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-00000000a001', 'https://push.example.test/a', 'key-a', 'auth-a'),
  ('00000000-0000-0000-0000-00000000b002', 'https://push.example.test/b', 'key-b', 'auth-b'),
  ('00000000-0000-0000-0000-00000000c003', 'https://push.example.test/c', 'key-c', 'auth-c');

-- Workouts planned on Oct 1 for everyone; A also has a rest day on Oct 2.
insert into workout_plans (id, user_id, date, title) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-00000000a001', '2026-10-01', 'Push'),
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-00000000b002', '2026-10-01', null),
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-00000000c003', '2026-10-01', 'Legs');
insert into workout_plans (user_id, date, title, is_rest_day, off_kind) values
  ('00000000-0000-0000-0000-00000000a001', '2026-10-02', null, true, 'rest');
insert into planned_exercises (plan_id, exercise_id, position)
select '00000000-0000-0000-0000-000000000a01', id, row_number() over () - 1
from (select id from exercises where user_id is null order by name limit 2) e;

do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000a001';
  b constant uuid := '00000000-0000-0000-0000-00000000b002';
  got uuid[];
  row record;
  log_id uuid;
  le_id uuid;
begin
  -- Before A's reminder time: nobody (B's 07:00 IST was hours ago and outside the window).
  select array_agg(user_id) into got from due_workout_reminders('2026-10-01 17:59:00+00');
  if got is not null then raise exception 'due at 17:59 UTC: expected nobody, got %', got; end if;

  -- 18:30 UTC: A is due, with the plan title and exercise count. C has reminders off.
  select * into row from due_workout_reminders('2026-10-01 18:30:00+00');
  if row.user_id is distinct from a or row.local_date <> '2026-10-01' or row.plan_title <> 'Push' or row.exercise_count <> 2 then
    raise exception 'due at 18:30 UTC: expected A / 2026-10-01 / Push / 2, got % / % / % / %',
      row.user_id, row.local_date, row.plan_title, row.exercise_count;
  end if;
  if (select count(*) from due_workout_reminders('2026-10-01 18:30:00+00')) <> 1 then
    raise exception 'due at 18:30 UTC: expected only A';
  end if;

  -- The window closes 3 hours after the reminder time.
  if exists (select 1 from due_workout_reminders('2026-10-01 21:01:00+00')) then
    raise exception 'due at 21:01 UTC: the 3-hour window should have closed';
  end if;

  -- B's 07:00 in India is 01:30 UTC; B's "today" is their local date.
  select array_agg(user_id) into got from due_workout_reminders('2026-10-01 01:45:00+00');
  if got is distinct from array[b] then raise exception 'due at 07:15 IST: expected B, got %', got; end if;

  -- Once a reminder is recorded for the day, not again.
  update profiles set reminder_last_sent_on = '2026-10-01' where id = a;
  if exists (select 1 from due_workout_reminders('2026-10-01 18:45:00+00')) then
    raise exception 'a reminder already sent today should not be sent again';
  end if;
  update profiles set reminder_last_sent_on = '2026-09-30' where id = a;

  -- Not after training today: a performed set cancels the reminder (a blank one doesn't).
  insert into workout_logs (user_id, date) values (a, '2026-10-01') returning id into log_id;
  insert into logged_exercises (log_id, exercise_id) values (log_id, (select id from exercises where user_id is null limit 1))
  returning id into le_id;
  insert into logged_sets (logged_exercise_id, set_number, reps, weight) values (le_id, 1, null, null);
  if not exists (select 1 from due_workout_reminders('2026-10-01 18:30:00+00')) then
    raise exception 'a blank planned set should not cancel the reminder';
  end if;
  update logged_sets set reps = 5 where logged_exercise_id = le_id;
  if exists (select 1 from due_workout_reminders('2026-10-01 18:30:00+00')) then
    raise exception 'a performed set today should cancel the reminder';
  end if;

  -- Not on a rest day.
  if exists (select 1 from due_workout_reminders('2026-10-02 18:30:00+00')) then
    raise exception 'no reminder on a rest day';
  end if;

  -- Not without a device, and an unknown timezone counts as UTC.
  delete from workout_logs where id = log_id;
  update profiles set timezone = 'Not/AZone' where id = a;
  if not exists (select 1 from due_workout_reminders('2026-10-01 18:30:00+00')) then
    raise exception 'an unknown timezone should fall back to UTC';
  end if;
  delete from push_subscriptions where user_id = a;
  if exists (select 1 from due_workout_reminders('2026-10-01 18:30:00+00')) then
    raise exception 'no reminder without a registered device';
  end if;
end $$;

-- As B: register a device, take over an endpoint another account had, and only ever see own rows.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);

do $$
begin
  perform register_push_subscription('https://push.example.test/c', 'key-new', 'auth-new', 'Test browser');
  if (select count(*) from push_subscriptions) <> 2 then
    raise exception 'B should see exactly its own two devices, saw %', (select count(*) from push_subscriptions);
  end if;
  if exists (select 1 from push_subscriptions where endpoint = 'https://push.example.test/c' and p256dh <> 'key-new') then
    raise exception 'registering an endpoint should replace its keys';
  end if;

  begin
    perform * from due_workout_reminders();
    raise exception 'signed-in people must not be able to list due reminders';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-00000000b002', 'https://push.example.test/direct', 'k', 'a');
    raise exception 'devices should only be added through register_push_subscription';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
do $$
begin
  if (select user_id from push_subscriptions where endpoint = 'https://push.example.test/c') <> '00000000-0000-0000-0000-00000000b002' then
    raise exception 'the endpoint should now belong to B, not C';
  end if;
  if (select count(*) from push_subscriptions where endpoint = 'https://push.example.test/c') <> 1 then
    raise exception 'the endpoint should not be duplicated';
  end if;
end $$;

select 'workout_reminders: all checks passed' as result;

rollback;
