-- Holds back repeat notifications: when someone last got one of each kind (the notification's tag),
-- so a trainer saving plan after plan can't keep buzzing a client's phone. Only the server's
-- notifyUser uses it, through the service role: no policies, and no access for signed-in people.
create table notification_throttle (
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  last_sent_at timestamptz not null default now(),
  primary key (user_id, topic)
);

alter table notification_throttle enable row level security;
revoke all on notification_throttle from public, anon, authenticated;

-- True, and starts the gap again, if this person may be sent this kind of notification now.
-- One statement, so two saves at the same moment can't both be told yes.
create or replace function claim_notification(p_user_id uuid, p_topic text, p_min_gap interval)
returns boolean
language sql
set search_path = public
as $$
  with claimed as (
    insert into notification_throttle as t (user_id, topic)
    values (p_user_id, p_topic)
    on conflict (user_id, topic) do update set last_sent_at = now()
    where t.last_sent_at <= now() - p_min_gap
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke execute on function claim_notification(uuid, text, interval) from public, anon, authenticated;
grant execute on function claim_notification(uuid, text, interval) to service_role;
