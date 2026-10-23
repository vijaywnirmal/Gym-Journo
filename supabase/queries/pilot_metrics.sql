-- Trainer pilot metrics for one trainer. Read-only: a single SELECT that writes and creates nothing.
--
-- Edit the two values in `params`, then run the whole file (Supabase SQL editor or the SQL API).
-- See docs/pilot-checklist.md. Weeks are 7-day blocks from pilot_start: week 1 is pilot_start and
-- the 6 days after it, week 4 ends on day 28. Run mid-pilot, the current week is partial.
--
-- Output, one table:
--   summary      the pilot's numbers next to their good signs (the `result` column)
--   client week  one row per client per week they were linked to the trainer
--
-- Definitions:
--   workout days        logs with at least one performed set (reps or weight recorded), as in
--                       performed_workout_dates (0026) and the trainer's Clients screen
--   days planned        workout days on the client's plan, whoever made them. Days off (rest or
--                       away) don't count, as in "x of y this week" on the Clients screen
--   planned by trainer  of those, the ones the trainer made (workout_plans.created_by)
--   client edited       of the trainer's, the ones the client changed last (updated_by). A deleted
--                       plan, or one turned into a day off, no longer counts
--   linked              the client had an active link with the trainer at some point that week. A
--                       client who ended the link drops out from the next week, and counts as not
--                       logging in week 4
--
-- Invites go out on WhatsApp, outside the app, so "invites sent" isn't stored. The summary reports
-- join links made and clients who accepted during the pilot instead: the acceptance rate is
-- accepted divided by the number of clients the trainer says they sent the link to.
--
-- Plan and log dates are the client's own (stored as dates). Link and invite times are counted in
-- the trainer's time zone.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as trainer_id, -- EDIT: the trainer's user id
    date '2000-01-01' as pilot_start                             -- EDIT: the week 0 session date
),

pilot as (
  select
    params.trainer_id,
    params.pilot_start,
    params.pilot_start + 27 as pilot_end,
    tp.display_name as trainer_name,
    timezone_or_utc(pr.timezone) as tz
  from params
  left join trainer_profiles tp on tp.user_id = params.trainer_id
  left join profiles pr on pr.id = params.trainer_id
),

weeks as (
  select
    w as week,
    pilot.pilot_start + 7 * (w - 1) as week_start,
    pilot.pilot_start + 7 * (w - 1) + 6 as week_end
  from pilot, generate_series(1, 4) as w
),

-- Every link between the trainer and a client, as dates.
links as (
  select
    tc.client_id,
    tc.status,
    (tc.started_at at time zone pilot.tz)::date as started_on,
    (tc.ended_at at time zone pilot.tz)::date as ended_on
  from trainer_clients tc
  join pilot on pilot.trainer_id = tc.trainer_id
),

client_weeks as (
  select distinct l.client_id, w.week, w.week_start, w.week_end
  from links l
  join weeks w on l.started_on <= w.week_end and (l.ended_on is null or l.ended_on >= w.week_start)
),

clients as (
  select
    c.client_id,
    coalesce(
      nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(btrim(p.full_name), ''),
      'Client ' || left(c.client_id::text, 8)
    ) as name
  from (select distinct client_id from client_weeks) c
  left join profiles p on p.id = c.client_id
),

performed_days as (
  select l.user_id, l.date
  from workout_logs l
  join clients c on c.client_id = l.user_id
  join pilot on l.date between pilot.pilot_start and pilot.pilot_end
  where exists (
    select 1
    from logged_exercises le
    join logged_sets s on s.logged_exercise_id = le.id
    where le.log_id = l.id and (s.reps is not null or s.weight is not null)
  )
),

planned_days as (
  select
    wp.user_id,
    wp.date,
    coalesce(wp.created_by = pilot.trainer_id, false) as by_trainer,
    coalesce(wp.created_by = pilot.trainer_id and wp.updated_by = wp.user_id, false) as client_edited
  from workout_plans wp
  join clients c on c.client_id = wp.user_id
  join pilot on wp.date between pilot.pilot_start and pilot.pilot_end
  where not wp.is_rest_day
),

by_client_week as (
  select
    cw.client_id,
    cw.week,
    (select count(*) from performed_days d
      where d.user_id = cw.client_id and d.date between cw.week_start and cw.week_end)::int as workout_days,
    (select count(*) from planned_days d
      where d.user_id = cw.client_id and d.date between cw.week_start and cw.week_end)::int as days_planned,
    (select count(*) from planned_days d
      where d.user_id = cw.client_id and d.date between cw.week_start and cw.week_end and d.by_trainer)::int
      as planned_by_trainer,
    (select count(*) from planned_days d
      where d.user_id = cw.client_id and d.date between cw.week_start and cw.week_end and d.client_edited)::int
      as client_edited
  from client_weeks cw
),

week_totals as (
  select
    w.week,
    w.week_start,
    w.week_end,
    count(b.client_id)::int as linked,
    count(*) filter (where b.workout_days >= 3)::int as three_plus,
    count(*) filter (where b.planned_by_trainer > 0)::int as planned_for
  from weeks w
  left join by_client_week b on b.week = w.week
  group by w.week, w.week_start, w.week_end
),

accepted as (
  select distinct l.client_id
  from links l, pilot
  where l.started_on between pilot.pilot_start and pilot.pilot_end
),

summary (sort, item, result) as (
  select 1, 'Trainer',
    coalesce(pilot.trainer_name, 'NOT FOUND: check trainer_id in params')
      || ' · week 1 starts ' || to_char(pilot.pilot_start, 'FMDD Mon YYYY')
      || ', week 4 ends ' || to_char(pilot.pilot_end, 'FMDD Mon YYYY')
      || ' · ' || (
        select case
          when today < pilot.pilot_start then 'not started yet'
          when today > pilot.pilot_end then 'finished'
          else 'today is in week ' || ((today - pilot.pilot_start) / 7 + 1)
        end
        from (select (now() at time zone pilot.tz)::date as today) t
      )
  from pilot

  union all
  select 2, 'Join links made',
    (select count(*) from trainer_invites i
      where i.trainer_id = pilot.trainer_id
        and (i.created_at at time zone pilot.tz)::date between pilot.pilot_start and pilot.pilot_end)
      || ' during the pilot (invites sent on WhatsApp aren''t recorded)'
  from pilot

  union all
  select 3, 'Clients who accepted',
    (select count(*) from accepted)
      || ' during the pilot, ' || (
        select count(*) from accepted a
        where not exists (select 1 from links l where l.client_id = a.client_id and l.status = 'active')
      ) || ' of them since ended the link · good sign: 70%+ of the clients sent the link'

  union all
  select 10 + t.week,
    'Week ' || t.week || ' · ' || to_char(t.week_start, 'FMDD Mon') || '–' || to_char(t.week_end, 'FMDD Mon'),
    t.three_plus || ' of ' || t.linked || ' linked clients logged 3+ workout days · trainer planned for '
      || t.planned_for || ' of ' || t.linked
  from week_totals t

  union all
  select 20, 'Weeks half the clients or more logged 3+ days',
    count(*) filter (where t.linked > 0 and 2 * t.three_plus >= t.linked) || ' of 4 · good sign: most weeks'
  from week_totals t

  union all
  select 21, 'Weeks the trainer planned for half the clients or more',
    count(*) filter (where t.linked > 0 and 2 * t.planned_for >= t.linked) || ' of 4 · good sign: all 4'
  from week_totals t

  union all
  select 22, 'Clients logging in week 4',
    (select count(*) from by_client_week b where b.week = 4 and b.workout_days > 0)
      || ' of ' || (select count(*) from clients) || ' clients in the pilot · good sign: 6 of 10, or the same share'

  union all
  select 23, 'Trainer plans clients edited',
    'plans: ' || e.plans || ', clients who edited: ' || e.clients || ' · good sign: some'
  from (
    select coalesce(sum(b.client_edited), 0) as plans,
      count(distinct b.client_id) filter (where b.client_edited > 0) as clients
    from by_client_week b
  ) e
)

select section, item, workout_days, days_planned, planned_by_trainer, client_edited, result
from (
  select 1 as part, null::text as name, null::uuid as client_id, s.sort, 'summary' as section, s.item,
    null::int as workout_days, null::int as days_planned, null::int as planned_by_trainer,
    null::int as client_edited, s.result
  from summary s

  union all
  select 2, c.name, c.client_id, b.week, 'client week', c.name || ' · week ' || b.week,
    b.workout_days, b.days_planned, b.planned_by_trainer, b.client_edited, null
  from by_client_week b
  join clients c on c.client_id = b.client_id
) report
order by part, name, client_id, sort;
