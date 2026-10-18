-- Training stats computed in the database instead of in the app.
--
-- The Today, Body and Calendar screens used to download every log in a window with all of its
-- sets, only to reduce them to a handful of dates or per-muscle counts in TypeScript. These
-- functions return just the result. They are SECURITY INVOKER and filter on auth.uid(), so row-level
-- security and the (user_id, date) index both apply exactly as they do for the app's own queries.
--
-- Definitions match src/lib/analyze (definitions.ts, weeklyInsights.ts) and must stay in step:
--   PERFORMED SET  reps or weight recorded (a recorded 0 counts; a blank placeholder does not)
--   WORKOUT DAY    a log dated on or before the person's today with at least one performed set
--   HARD SET       a performed set that is not a warm-up; counts once toward every muscle group
--                  its exercise is tagged with
-- The caller passes the person's today as p_to (it depends on their time zone, which the app
-- resolves), so future-dated logs are never counted.

-- Workout days in [p_from, p_to], ascending. A null p_from means "from the beginning".
create function performed_workout_dates(p_from date, p_to date)
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
        and (s.reps is not null or s.weight is not null)
    )
  order by l.date;
$$;

-- Hard sets per muscle group for logs dated in [p_from, p_to]. Muscle groups with no hard sets
-- are omitted.
create function muscle_set_counts(p_from date, p_to date)
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
    and (s.reps is not null or s.weight is not null)
    and s.set_type <> 'warmup'
  group by mg.id, mg.name;
$$;

revoke execute on function performed_workout_dates(date, date) from public, anon;
revoke execute on function muscle_set_counts(date, date) from public, anon;
grant execute on function performed_workout_dates(date, date) to authenticated;
grant execute on function muscle_set_counts(date, date) to authenticated;
