-- Baseline numbers for the delivery plan (docs/delivery-plan.md, "Measuring pace and success"):
-- how GymJourno is used today, so each release can be compared against it. Read-only: a single
-- SELECT that writes and creates nothing, and returns counts only (no names, emails or workouts).
--
-- Run the whole file in the Supabase SQL editor (or the SQL API). Rerun after each release.
--
-- Optionally edit `params`: the first day of real sign-ups, test accounts to leave out (by email),
-- and the day to measure "as of" (today by default). Accounts on example.test, and any email containing "+gjtest"
-- (Gmail-style aliases for the live test accounts), are always left out.
-- Every account created before 7 November 2026 is a test account, so only accounts created on or
-- after `real_from` count (and gyms and trainers only when their owner's account does).
--
-- Output, one table: area, measure, value, and what it means.
--
-- Definitions:
--   workout day      a day with at least one performed set (reps or weight recorded), as in
--                    performed_workout_dates (0026). Release 1 will add sessions to this.
--   individual       a finished sign-up (onboarded) that isn't a trainer and doesn't run a gym,
--                    and isn't paused (disabled)
--   week 2 / week 4  days 7–13 / 21–27 after sign-up, in the person's own time zone. Only people
--                    who signed up long enough ago to have finished that week are counted
--   active client    a client with an active link to a trainer
--   planning day     a day a trainer created a plan for a client (plans don't record later edits
--                    by date, so this undercounts trainers who mostly edit). There's no record of
--                    when someone opens the app, so this is the closest measure of trainer use
--   came back        an active gym member who trained in the last 7 days after 7 or more days
--                    without training

with params as (
  select
    date '2026-11-07' as real_from,           -- accounts created before this are test accounts
    array[]::text[] as exclude_emails,       -- EDIT: e.g. array['test@yourdomain.com']
    current_date as as_of                     -- EDIT: to measure as of another day
),

people as (
  select u.id, u.created_at, coalesce(p.timezone, 'UTC') as tz, p.onboarded, p.disabled_at
  from auth.users u
  join profiles p on p.id = u.id
  cross join params
  where u.email not like '%@example.test'
    and u.email not like '%+gjtest%'
    and not (u.email = any (params.exclude_emails))
    and u.created_at >= params.real_from
),

work_accounts as (
  select user_id as id from trainer_profiles
  union
  select owner_id from gyms
  union
  select user_id from gym_staff where status = 'active' and role = 'admin'
),

individuals as (
  select pe.*, (pe.created_at at time zone pe.tz)::date as signup_day
  from people pe
  where pe.onboarded and pe.disabled_at is null
    and pe.id not in (select id from work_accounts)
),

workout_days as (
  select distinct l.user_id, l.date
  from workout_logs l
  where exists (
    select 1
    from logged_exercises le
    join logged_sets s on s.logged_exercise_id = le.id
    where le.log_id = l.id and (s.reps is not null or s.weight is not null)
  )
),

retention as (
  select
    count(*) filter (where i.signup_day <= params.as_of - 14) as week2_cohort,
    count(*) filter (where i.signup_day <= params.as_of - 14 and exists (
      select 1 from workout_days w where w.user_id = i.id and w.date between i.signup_day + 7 and i.signup_day + 13
    )) as week2_logged,
    count(*) filter (where i.signup_day <= params.as_of - 28) as week4_cohort,
    count(*) filter (where i.signup_day <= params.as_of - 28 and exists (
      select 1 from workout_days w where w.user_id = i.id and w.date between i.signup_day + 21 and i.signup_day + 27
    )) as week4_logged,
    count(*) as individuals,
    count(*) filter (where exists (
      select 1 from workout_days w where w.user_id = i.id and w.date > params.as_of - 7 and w.date <= params.as_of
    )) as active_7,
    count(*) filter (where exists (
      select 1 from workout_days w where w.user_id = i.id and w.date > params.as_of - 28 and w.date <= params.as_of
    )) as active_28
  from individuals i
  cross join params
),

trainers as (
  select t.user_id as id
  from trainer_profiles t
  join people pe on pe.id = t.user_id
),

trainer_stats as (
  select
    t.id,
    (select count(*) from trainer_clients c where c.trainer_id = t.id and c.status = 'active') as active_clients,
    (select count(distinct (wp.created_at at time zone 'UTC')::date)
       from workout_plans wp, params
       where wp.created_by = t.id and wp.user_id <> t.id
         and (wp.created_at at time zone 'UTC')::date > params.as_of - 28
         and (wp.created_at at time zone 'UTC')::date <= params.as_of) as planning_days_28
  from trainers t
),

gym_list as (
  select g.id
  from gyms g
  join people pe on pe.id = g.owner_id
),

members as (
  select m.user_id, m.gym_id
  from gym_members m
  where m.status = 'active' and m.gym_id in (select id from gym_list)
),

member_stats as (
  select
    m.user_id,
    exists (
      select 1 from workout_days w, params
      where w.user_id = m.user_id and w.date > params.as_of - 7 and w.date <= params.as_of
    ) as active_7,
    -- Trained in the last 7 days, and the workout before the first of those was 8+ days earlier.
    exists (
      select 1 from params,
      lateral (
        select min(w.date) as first_recent from workout_days w
        where w.user_id = m.user_id and w.date > params.as_of - 7 and w.date <= params.as_of
      ) r,
      lateral (
        select max(w.date) as previous from workout_days w
        where w.user_id = m.user_id and w.date < r.first_recent
      ) b
      where r.first_recent is not null and b.previous is not null and r.first_recent - b.previous >= 8
    ) as came_back
  from members m
),

summary (area, sort, measure, value, meaning) as (
  select 'Individuals', 1, 'Individuals (finished sign-up)', r.individuals::text, 'Not trainers or gym staff; paused accounts left out' from retention r
  union all
  select 'Individuals', 2, 'Logged in week 2 after sign-up',
    case when r.week2_cohort = 0 then 'n/a' else round(100.0 * r.week2_logged / r.week2_cohort) || '% (' || r.week2_logged || ' of ' || r.week2_cohort || ')' end,
    'Signed up 14+ days ago and logged a workout on days 7–13' from retention r
  union all
  select 'Individuals', 3, 'Logged in week 4 after sign-up',
    case when r.week4_cohort = 0 then 'n/a' else round(100.0 * r.week4_logged / r.week4_cohort) || '% (' || r.week4_logged || ' of ' || r.week4_cohort || ')' end,
    'Signed up 28+ days ago and logged a workout on days 21–27' from retention r
  union all
  select 'Individuals', 4, 'Trained in the last 7 days', r.active_7 || ' of ' || r.individuals, 'At least one workout day' from retention r
  union all
  select 'Individuals', 5, 'Trained in the last 28 days', r.active_28 || ' of ' || r.individuals, 'At least one workout day' from retention r
  union all
  select 'Trainers', 6, 'Trainers', count(*)::text, 'Accounts with a trainer profile' from trainer_stats
  union all
  select 'Trainers', 7, 'Active clients per trainer',
    coalesce(round(avg(active_clients), 1)::text || ' average, ' || max(active_clients) || ' most', 'n/a'),
    'Clients with an active link' from trainer_stats
  union all
  select 'Trainers', 8, 'Planning days per week',
    coalesce(round(avg(planning_days_28) / 4.0, 1)::text || ' average', 'n/a'),
    'Days a trainer created a client plan, last 28 days ÷ 4 (closest measure of trainer use)' from trainer_stats
  union all
  select 'Trainers', 9, 'Trainers who planned in the last 28 days', count(*) filter (where planning_days_28 > 0) || ' of ' || count(*), '' from trainer_stats
  union all
  select 'Gyms', 10, 'Gyms', (select count(*) from gym_list)::text, ''
  union all
  select 'Gyms', 11, 'Active gym members', count(*)::text, 'Members with an active link to a gym' from member_stats
  union all
  select 'Gyms', 12, 'Members who trained in the last 7 days',
    case when count(*) = 0 then 'n/a' else round(100.0 * count(*) filter (where active_7) / count(*)) || '% (' || count(*) filter (where active_7) || ' of ' || count(*) || ')' end,
    '' from member_stats
  union all
  select 'Gyms', 13, 'Quiet members who came back', (count(*) filter (where came_back))::text,
    'Trained in the last 7 days after 7+ days without training' from member_stats
)

select area, measure, value, meaning, (select as_of from params) as as_of
from summary
order by sort;
