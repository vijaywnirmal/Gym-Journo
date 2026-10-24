-- The gym's members list also says when a member declined the trainer the gym suggested: while they
-- have no trainer and nothing new is suggested, and declining was their last answer to this gym
-- since joining it. So the gym knows to ask someone else instead of seeing "Needs a trainer" as if
-- nothing happened. Found in the internal test pass.
-- The columns change, so the function is dropped and made again (same checks and grants as 0037).

drop function gym_member_overview(uuid);

create function gym_member_overview(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  joined_at timestamptz,
  trainer_id uuid,
  trainer_name text,
  offered_trainer_id uuid,
  offered_trainer_name text,
  declined_trainer_id uuid,
  declined_trainer_name text,
  has_own_trainer boolean,
  workouts_this_week int,
  days_since_last_workout int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_gym_admin(p_gym_id);
  return query
  with members as (
    select m.user_id, m.started_at, p.first_name, p.last_name,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from gym_members m
    left join profiles p on p.id = m.user_id
    where m.gym_id = p_gym_id and m.status = 'active'
  ),
  performed as (
    select l.user_id, l.date
    from workout_logs l
    join members on members.user_id = l.user_id
    where l.date <= members.today
      and exists (
        select 1 from logged_exercises le
        join logged_sets s on s.logged_exercise_id = le.id
        where le.log_id = l.id and (s.reps is not null or s.weight is not null)
      )
  )
  select
    members.user_id,
    members.first_name,
    members.last_name,
    members.started_at,
    case when tc.gym_id = p_gym_id then tc.trainer_id end,
    case when tc.gym_id = p_gym_id then tp.display_name end,
    o.trainer_id,
    otp.display_name,
    case when o.id is null and tc.id is null and answered.status = 'declined' then answered.trainer_id end,
    case when o.id is null and tc.id is null and answered.status = 'declined' then dtp.display_name end,
    tc.id is not null and tc.gym_id is distinct from p_gym_id,
    (select count(*)::int from performed
      where performed.user_id = members.user_id
        and performed.date >= members.today - (extract(isodow from members.today)::int - 1)),
    members.today - (select max(performed.date) from performed where performed.user_id = members.user_id)
  from members
  left join trainer_clients tc on tc.client_id = members.user_id and tc.status = 'active'
  left join trainer_profiles tp on tp.user_id = tc.trainer_id
  left join gym_trainer_offers o on o.member_id = members.user_id and o.gym_id = p_gym_id and o.status = 'pending'
  left join trainer_profiles otp on otp.user_id = o.trainer_id
  -- The member's last answer to this gym since they joined it.
  left join lateral (
    select d.trainer_id, d.status
    from gym_trainer_offers d
    where d.member_id = members.user_id and d.gym_id = p_gym_id
      and d.status in ('accepted', 'declined') and d.created_at >= members.started_at
    order by d.decided_at desc, d.created_at desc
    limit 1
  ) answered on true
  left join trainer_profiles dtp on dtp.user_id = answered.trainer_id
  order by members.first_name nulls last, members.started_at;
end;
$$;

revoke execute on function gym_member_overview(uuid) from public, anon;
grant execute on function gym_member_overview(uuid) to authenticated;
