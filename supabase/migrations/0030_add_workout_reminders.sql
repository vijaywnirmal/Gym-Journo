-- Workout reminders over web push.
--
-- push_subscriptions  one row per device (browser push endpoint) a person has allowed notifications
--                     on. Registered through register_push_subscription, which moves an endpoint to
--                     whoever registers it last (one phone, a different account signing in).
-- profiles            workout_reminders (on/off, off by default), reminder_time (the person's local
--                     time of day), reminder_last_sent_on (their local date of the last reminder, so
--                     at most one a day).
-- due_workout_reminders(now) lists who should get a reminder now: reminders on, at least one device,
-- a workout (not a rest or absence day) planned for their today, nothing performed yet today, and
-- their local time within REMINDER_WINDOW after their reminder time. Called by the server's
-- reminder job with the service role; nobody else can execute it.

alter table profiles
  add column workout_reminders boolean not null default false,
  add column reminder_time time not null default '18:00',
  add column reminder_last_sent_on date;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
-- People see and remove their own devices; adding one goes through register_push_subscription.
create policy "push_subscriptions select own" on push_subscriptions for select using (user_id = auth.uid());
create policy "push_subscriptions delete own" on push_subscriptions for delete using (user_id = auth.uid());

-- Saves this browser's subscription for the signed-in person. An endpoint belongs to one device, so
-- a row for it under another account is replaced rather than duplicated. SECURITY DEFINER only to
-- do that replacement; everything else is checked here.
create function register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500));
end;
$$;

-- The timezone if Postgres knows it, else UTC.
create function timezone_or_utc(p_timezone text)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_timezone is null or p_timezone = '' then
    return 'UTC';
  end if;
  perform now() at time zone p_timezone;
  return p_timezone;
exception
  when invalid_parameter_value then
    return 'UTC';
end;
$$;

create function due_workout_reminders(p_now timestamptz default now(), p_window interval default interval '3 hours')
returns table (user_id uuid, local_date date, plan_title text, exercise_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  with people as (
    select p.id, p.reminder_time, p.reminder_last_sent_on,
           (p_now at time zone timezone_or_utc(p.timezone)) as local_now
    from profiles p
    where p.workout_reminders
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
  )
  select pe.id, pe.local_now::date, wp.title,
         (select count(*) from planned_exercises pl where pl.plan_id = wp.id)::integer
  from people pe
  join workout_plans wp on wp.user_id = pe.id and wp.date = pe.local_now::date and not wp.is_rest_day
  where pe.local_now >= pe.local_now::date + pe.reminder_time
    and pe.local_now < pe.local_now::date + pe.reminder_time + p_window
    and pe.reminder_last_sent_on is distinct from pe.local_now::date
    and not exists (
      select 1
      from workout_logs l
      join logged_exercises le on le.log_id = l.id
      join logged_sets s on s.logged_exercise_id = le.id
      where l.user_id = pe.id and l.date = pe.local_now::date
        and (s.reps is not null or s.weight is not null)
    );
$$;

revoke execute on function register_push_subscription(text, text, text, text) from public, anon;
grant execute on function register_push_subscription(text, text, text, text) to authenticated;
revoke execute on function due_workout_reminders(timestamptz, interval) from public, anon, authenticated;
grant execute on function due_workout_reminders(timestamptz, interval) to service_role;
