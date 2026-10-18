-- Paged exercise browsing, so no screen has to download the whole library.
--
-- The library, and the pickers on the log and schedule screens, list exercises ten at a time
-- through these functions (via /api/exercises). All are SECURITY INVOKER: row-level security
-- decides what's visible exactly as for a plain select (the shared library plus the person's own
-- exercises).
--
-- Search follows src/lib/exerciseSearch.ts: the app normalises the term and expands shorthand
-- ("db" -> "dumbbell") into p_words, and an exercise matches when every word appears in its name,
-- equipment or muscle group names, compared lowercase with punctuation removed.

-- Lowercase, apostrophes dropped ("Farmer's" -> "farmers"), other punctuation to single spaces.
create function exercise_search_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p_value, '')), '[''’]', '', 'g'), '[^a-z0-9]+', ' ', 'g'));
$$;

-- True when the exercise matches the filters shared by the list and the counts.
create function exercise_matches(p_exercise exercises, p_words text[], p_equipment text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (p_equipment is null or lower(p_exercise.equipment) = lower(p_equipment))
    and (
      coalesce(cardinality(p_words), 0) = 0
      or not exists (
        select 1
        from unnest(p_words) as w(word)
        where position(
          w.word in exercise_search_text(
            concat_ws(
              ' ',
              p_exercise.name,
              p_exercise.equipment,
              (
                select string_agg(mg.name, ' ')
                from exercise_muscle_groups emg
                join muscle_groups mg on mg.id = emg.muscle_group_id
                where emg.exercise_id = p_exercise.id
              )
            )
          )
        ) = 0
      )
    );
$$;

-- One page of exercises ordered by name, optionally within one muscle group. Keyset pagination:
-- pass the last row's (name, id) as p_after_name / p_after_id for the next page. p_limit is
-- clamped to 1..50.
create function browse_exercises(
  p_muscle_group_id uuid default null,
  p_words text[] default null,
  p_equipment text default null,
  p_after_name text default null,
  p_after_id uuid default null,
  p_limit integer default 10
)
returns table (id uuid, name text, equipment text, user_id uuid, has_tutorial boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.name, e.equipment, e.user_id, (e.instructions is not null or e.demo_images is not null)
  from exercises e
  where (
      p_muscle_group_id is null
      or exists (
        select 1 from exercise_muscle_groups emg
        where emg.exercise_id = e.id and emg.muscle_group_id = p_muscle_group_id
      )
    )
    and exercise_matches(e, p_words, p_equipment)
    and (p_after_name is null or (e.name, e.id) > (p_after_name, p_after_id))
  order by e.name, e.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- Every muscle group with how many visible exercises in it match the filters (zero included).
create function exercise_group_counts(p_words text[] default null, p_equipment text default null)
returns table (muscle_group_id uuid, name text, exercise_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select mg.id, mg.name, count(e.id)::integer
  from muscle_groups mg
  left join exercise_muscle_groups emg on emg.muscle_group_id = mg.id
  left join exercises e on e.id = emg.exercise_id and exercise_matches(e, p_words, p_equipment)
  group by mg.id, mg.name
  order by mg.name;
$$;

-- The exercises this person has logged at least once, by name — for the History and Progress
-- filters, which only make sense for exercises with history.
create function logged_exercise_options()
returns table (id uuid, name text)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.name
  from exercises e
  where exists (
    select 1
    from logged_exercises le
    join workout_logs l on l.id = le.log_id
    where le.exercise_id = e.id and l.user_id = auth.uid()
  )
  order by e.name, e.id;
$$;

-- Keyset pages walk exercises in (name, id) order.
create index exercises_name_id_idx on exercises (name, id);

revoke execute on function exercise_matches(exercises, text[], text) from public, anon;
revoke execute on function browse_exercises(uuid, text[], text, text, uuid, integer) from public, anon;
revoke execute on function exercise_group_counts(text[], text) from public, anon;
revoke execute on function logged_exercise_options() from public, anon;
grant execute on function exercise_matches(exercises, text[], text) to authenticated;
grant execute on function browse_exercises(uuid, text[], text, text, uuid, integer) to authenticated;
grant execute on function exercise_group_counts(text[], text) to authenticated;
grant execute on function logged_exercise_options() to authenticated;
