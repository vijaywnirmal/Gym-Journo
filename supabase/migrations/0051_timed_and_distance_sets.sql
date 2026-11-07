-- Release 1, I1.1–I1.3: exercises know how they're measured, and sets can record a duration or a
-- distance (docs/delivery-plan.md).
--
--   exercises.measure        weight_reps (default: every existing exercise, unchanged)
--                            time        holds and timed work: a duration per set (plank 60 s)
--                            distance    distance and time per entry, with pace (5 km in 28:30)
--   logged_sets.duration_seconds, distance, distance_unit (km | mi)
--
-- "Performed" now also counts a set with a duration or a distance, everywhere a day decides whether
-- someone trained (calendar, streaks, reminders, trainer and gym views). Additive: new columns are
-- nullable or defaulted, and the old app keeps working against this schema (README).

alter table exercises
  add column measure text not null default 'weight_reps'
    constraint exercises_measure_valid check (measure in ('weight_reps', 'time', 'distance'));

-- Library exercises that are held or timed, or covered as a distance.
update exercises set measure = 'time' where user_id is null and name in ('Plank', 'Side Plank', 'Jump Rope', 'Rope Jumping', 'Battling Ropes', 'Farmer''s Carry', 'Elliptical', 'Elliptical Trainer', 'Stair Climber', 'Stairmaster', 'Step Mill', 'Assault Bike');
update exercises set measure = 'distance' where user_id is null and name in ('Treadmill Run', 'Running, Treadmill', 'Jogging, Treadmill', 'Walking, Treadmill', 'Trail Running/Walking', 'Cycling', 'Bicycling', 'Bicycling, Stationary', 'Recumbent Bike', 'Rowing Machine', 'Rowing, Stationary', 'Skating');

alter table logged_sets
  add column duration_seconds int
    constraint logged_sets_duration_valid check (duration_seconds is null or duration_seconds between 0 and 86400),
  add column distance numeric(8, 3)
    constraint logged_sets_distance_valid check (distance is null or (distance >= 0 and distance <= 1000)),
  add column distance_unit text not null default 'km'
    constraint logged_sets_distance_unit_valid check (distance_unit in ('km', 'mi'));

-- A custom exercise's measure can't change once it has logged sets: old sets would no longer make
-- sense under the new kind. (The app has no way to change it today; this keeps it that way.)
create function guard_exercise_measure_change() returns trigger
language plpgsql
as $$
begin
  if new.measure is distinct from old.measure and exists (
    select 1 from logged_exercises le where le.exercise_id = old.id
  ) then
    raise exception 'This exercise already has logged sets, so how it''s measured can''t change. Make a new exercise instead.';
  end if;
  return new;
end;
$$;

create trigger exercises_measure_guard before update of measure on exercises
  for each row when (old.user_id is not null) execute function guard_exercise_measure_change();

-- performed_workout_dates: as in 0026_add_stats_functions.sql, with timed and distance sets counting as performed.
create or replace function performed_workout_dates(p_from date, p_to date)
returns table (date date)
language sql
stable
security invoker
set search_path = public
as $$
  select l.date
  from workout_logs l
  where l.user_id = auth.uid()
    and (p_from is null or l.date >= p_from)
    and l.date <= p_to
    and exists (
      select 1
      from logged_exercises le
      join logged_sets s on s.logged_exercise_id = le.id
      where le.log_id = l.id
        and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
    )
  order by l.date;
$$;

-- muscle_set_counts: as in 0026_add_stats_functions.sql, with timed and distance sets counting as performed.
create or replace function muscle_set_counts(p_from date, p_to date)
returns table (muscle_group_id uuid, name text, sets integer)
language sql
stable
security invoker
set search_path = public
as $$
  select mg.id, mg.name, count(*)::integer
  from workout_logs l
  join logged_exercises le on le.log_id = l.id
  join logged_sets s on s.logged_exercise_id = le.id
  join exercise_muscle_groups emg on emg.exercise_id = le.exercise_id
  join muscle_groups mg on mg.id = emg.muscle_group_id
  where l.user_id = auth.uid()
    and l.date between p_from and p_to
    and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
    and s.set_type <> 'warmup'
  group by mg.id, mg.name;
$$;

-- due_workout_reminders: as in 0030_add_workout_reminders.sql, with timed and distance sets counting as performed.
create or replace function due_workout_reminders(p_now timestamptz default now(), p_window interval default interval '3 hours')
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
        and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
    );
$$;

-- trainer_client_overview: as in 0034_add_trainers.sql, with timed and distance sets counting as performed.
create or replace function trainer_client_overview()
returns table (
  link_id uuid,
  client_id uuid,
  first_name text,
  last_name text,
  primary_goal text,
  experience_level text,
  training_days_per_week int,
  started_at timestamptz,
  client_today date,
  today_plan text,
  today_done boolean,
  planned_this_week int,
  done_this_week int,
  last_workout_on date,
  latest_weight_kg numeric,
  latest_weight_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with clients as (
    select tc.id, tc.client_id, tc.started_at, p.first_name, p.last_name, p.primary_goal,
      p.experience_level, p.training_days_per_week,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from trainer_clients tc
    left join profiles p on p.id = tc.client_id
    where tc.trainer_id = auth.uid() and tc.status = 'active'
  ),
  links as (
    select clients.*, today - (extract(isodow from today)::int - 1) as week_start from clients
  ),
  performed as (
    select l.user_id, l.date
    from workout_logs l
    join links on links.client_id = l.user_id
    where l.date <= links.today
      and exists (
        select 1 from logged_exercises le
        join logged_sets s on s.logged_exercise_id = le.id
        where le.log_id = l.id and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
      )
  )
  select
    links.id,
    links.client_id,
    links.first_name,
    links.last_name,
    links.primary_goal,
    links.experience_level,
    links.training_days_per_week,
    links.started_at,
    links.today,
    (select coalesce(wp.off_kind, 'workout') from workout_plans wp
      where wp.user_id = links.client_id and wp.date = links.today),
    exists (select 1 from performed where performed.user_id = links.client_id and performed.date = links.today),
    (select count(*)::int from workout_plans wp
      where wp.user_id = links.client_id and not wp.is_rest_day
        and wp.date between links.week_start and links.week_start + 6),
    (select count(*)::int from performed
      where performed.user_id = links.client_id and performed.date >= links.week_start),
    (select max(performed.date) from performed where performed.user_id = links.client_id),
    bw.weight_kg,
    bw.date
  from links
  left join lateral (
    select b.weight_kg, b.date from body_measurements b
    where b.user_id = links.client_id order by b.date desc limit 1
  ) bw on true
  order by links.first_name nulls last, links.started_at;
$$;

-- gym_member_overview: as in 0038_gym_declined_offers.sql, with timed and distance sets counting as performed.
create or replace function gym_member_overview(p_gym_id uuid)
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
        where le.log_id = l.id and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
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

-- gym_trainer_overview: as in 0047_trainer_overview_new_clients.sql, with timed and distance sets counting as performed.
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
            and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
        )
        and (
          a.started_at <= now() - interval '7 days'
          or exists (
            select 1 from workout_logs l
            join logged_exercises le on le.log_id = l.id
            join logged_sets s on s.logged_exercise_id = le.id
            where l.user_id = a.client_id and (s.reps is not null or s.weight is not null or s.duration_seconds is not null or s.distance is not null)
          )
        ))
  from trainers
  order by trainers.display_name;
end;
$$;

-- client_logs: as in 0034_add_trainers.sql, now also sending duration and distance to the trainer.
create or replace function client_logs(p_client_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'Choose a range of up to 120 days';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'date', l.date,
      'plan_id', l.plan_id,
      'notes', l.notes,
      'completed_at', l.completed_at,
      'exercises', coalesce((
        select jsonb_agg(jsonb_build_object(
          'exercise_id', le.exercise_id,
          'name', e.name,
          'position', le.position,
          'notes', le.notes,
          'sets', coalesce((
            select jsonb_agg(jsonb_build_object(
              'set_number', s.set_number,
              'reps', s.reps,
              'weight', s.weight,
              'weight_unit', s.weight_unit,
              'set_type', s.set_type,
              'rpe', s.rpe,
              'duration_seconds', s.duration_seconds,
              'distance', s.distance,
              'distance_unit', s.distance_unit,
              'notes', s.notes
            ) order by s.set_number)
            from logged_sets s where s.logged_exercise_id = le.id
          ), '[]'::jsonb)
        ) order by le.position)
        from logged_exercises le join exercises e on e.id = le.exercise_id
        where le.log_id = l.id
      ), '[]'::jsonb)
    ) order by l.date)
    from workout_logs l
    where l.user_id = p_client_id and l.date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- save_workout_log: as in 0020_add_set_type_rpe_exercise_notes.sql, now also writing duration and distance. Missing keys save as
-- null, so an older app (or offline-queued workout) still saves exactly as before.
create or replace function save_workout_log(
  p_date date,
  p_plan_id uuid,
  p_notes text,
  p_completed boolean,
  p_exercises jsonb
) returns workout_logs
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_log workout_logs;
  v_exercise jsonb;
  v_logged_exercise_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from workout_plans wp where wp.id = p_plan_id and wp.user_id = v_user_id
  ) then
    raise exception 'Invalid plan reference';
  end if;

  insert into workout_logs (user_id, date, plan_id, notes, completed_at)
  values (
    v_user_id,
    p_date,
    p_plan_id,
    p_notes,
    case when p_completed then now() else null end
  )
  on conflict (user_id, date) do update set
    plan_id = excluded.plan_id,
    notes = excluded.notes,
    completed_at = excluded.completed_at
  returning * into v_log;

  delete from logged_exercises where log_id = v_log.id;

  for v_exercise in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    insert into logged_exercises (log_id, exercise_id, position, notes)
    values (
      v_log.id,
      (v_exercise ->> 'exercise_id')::uuid,
      (v_exercise ->> 'position')::int,
      nullif(v_exercise ->> 'notes', '')
    )
    returning id into v_logged_exercise_id;

    insert into logged_sets (logged_exercise_id, set_number, reps, weight, weight_unit, set_type, rpe,
                             duration_seconds, distance, distance_unit)
    select
      v_logged_exercise_id,
      (s ->> 'set_number')::int,
      nullif(s ->> 'reps', '')::int,
      nullif(s ->> 'weight', '')::numeric,
      coalesce(nullif(s ->> 'weight_unit', ''), 'kg'),
      coalesce(nullif(s ->> 'set_type', ''), 'working'),
      nullif(s ->> 'rpe', '')::numeric,
      nullif(s ->> 'duration_seconds', '')::int,
      nullif(s ->> 'distance', '')::numeric,
      coalesce(nullif(s ->> 'distance_unit', ''), 'km')
    from jsonb_array_elements(coalesce(v_exercise -> 'sets', '[]'::jsonb)) s;
  end loop;

  return v_log;
end;
$$;
