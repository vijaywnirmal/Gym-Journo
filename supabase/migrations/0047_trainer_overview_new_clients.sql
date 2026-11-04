-- A gym's count of a trainer's members "not training in the last 7 days" also counted people who had
-- only just started with that trainer. Someone who has never logged a workout now gets those 7 days
-- from starting, as on the trainer's own screens (isQuietClient). Same function otherwise.
create or replace function gym_trainer_overview(p_gym_id uuid)
returns table (
  trainer_id uuid,
  display_name text,
  joined_at timestamptz,
  members_assigned int,
  plans_this_week int,
  members_inactive_7_days int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_gym_admin(p_gym_id);
  return query
  with trainers as (
    select s.user_id, s.started_at, tp.display_name,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from gym_staff s
    join trainer_profiles tp on tp.user_id = s.user_id
    left join profiles p on p.id = s.user_id
    where s.gym_id = p_gym_id and s.role = 'trainer' and s.status = 'active'
  ),
  assigned as (
    select tc.trainer_id, tc.client_id, tc.started_at
    from trainer_clients tc
    where tc.gym_id = p_gym_id and tc.status = 'active'
  )
  select
    trainers.user_id,
    trainers.display_name,
    trainers.started_at,
    (select count(*)::int from assigned a where a.trainer_id = trainers.user_id),
    (select count(*)::int from workout_plans wp
      join assigned a on a.client_id = wp.user_id and a.trainer_id = trainers.user_id
      where (wp.created_by = trainers.user_id or wp.updated_by = trainers.user_id)
        and wp.date between trainers.today - (extract(isodow from trainers.today)::int - 1)
                        and trainers.today - (extract(isodow from trainers.today)::int - 1) + 6),
    (select count(*)::int from assigned a
      where a.trainer_id = trainers.user_id
        and not exists (
          select 1 from workout_logs l
          join logged_exercises le on le.log_id = l.id
          join logged_sets s on s.logged_exercise_id = le.id
          where l.user_id = a.client_id and l.date > trainers.today - 7 and l.date <= trainers.today
            and (s.reps is not null or s.weight is not null)
        )
        and (
          a.started_at <= now() - interval '7 days'
          or exists (
            select 1 from workout_logs l
            join logged_exercises le on le.log_id = l.id
            join logged_sets s on s.logged_exercise_id = le.id
            where l.user_id = a.client_id and (s.reps is not null or s.weight is not null)
          )
        ))
  from trainers
  order by trainers.display_name;
end;
$$;
