-- Someone else ended the signed-in person's gym membership or trainer in the last 14 days, so
-- Profile can say so to people who don't get notifications. Their own rows only, and only names they
-- already knew. Their own decisions don't count, and neither does anything older than a membership or
-- trainer they've started since. Reads only.
create function my_recent_removals()
returns table (kind text, name text, ended_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  (select 'gym'::text, g.name, m.ended_at
   from gym_members m
   join gyms g on g.id = m.gym_id
   where m.user_id = auth.uid() and m.status = 'ended'
     and m.ended_by is distinct from auth.uid()
     and m.ended_at > now() - interval '14 days'
     and not exists (
       select 1 from gym_members later
       where later.user_id = m.user_id and later.started_at > m.ended_at
     )
   order by m.ended_at desc
   limit 1)
  union all
  (select 'trainer'::text, tp.display_name, tc.ended_at
   from trainer_clients tc
   join trainer_profiles tp on tp.user_id = tc.trainer_id
   where tc.client_id = auth.uid() and tc.status = 'ended'
     and tc.ended_by is distinct from auth.uid()
     and tc.ended_at > now() - interval '14 days'
     and not exists (
       select 1 from trainer_clients later
       where later.client_id = tc.client_id and later.started_at > tc.ended_at
     )
   order by tc.ended_at desc
   limit 1);
$$;

revoke execute on function my_recent_removals() from public, anon;
grant execute on function my_recent_removals() to authenticated;
