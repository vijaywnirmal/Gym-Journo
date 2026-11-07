-- Library search and filters can show timed or distance exercises (story I1.1).
--
-- browse_exercises and exercise_group_counts (0028) gain an optional p_measure, last and defaulting
-- to null (no filter). Callers that don't pass it, such as the app still running while this
-- migration applies, get exactly what they got before. Same bodies otherwise.

drop function browse_exercises(uuid, text[], text, text, uuid, integer);
drop function exercise_group_counts(text[], text);

create function browse_exercises(
  p_muscle_group_id uuid default null,
  p_words text[] default null,
  p_equipment text default null,
  p_after_name text default null,
  p_after_id uuid default null,
  p_limit integer default 10,
  p_measure text default null
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
    and (p_measure is null or e.measure = p_measure)
    and (p_after_name is null or (e.name, e.id) > (p_after_name, p_after_id))
  order by e.name, e.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

create function exercise_group_counts(
  p_words text[] default null,
  p_equipment text default null,
  p_measure text default null
)
returns table (muscle_group_id uuid, name text, exercise_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select mg.id, mg.name, count(e.id)::integer
  from muscle_groups mg
  left join exercise_muscle_groups emg on emg.muscle_group_id = mg.id
  left join exercises e
    on e.id = emg.exercise_id
    and exercise_matches(e, p_words, p_equipment)
    and (p_measure is null or e.measure = p_measure)
  group by mg.id, mg.name
  order by mg.name;
$$;

revoke execute on function browse_exercises(uuid, text[], text, text, uuid, integer, text) from public, anon;
revoke execute on function exercise_group_counts(text[], text, text) from public, anon;
grant execute on function browse_exercises(uuid, text[], text, text, uuid, integer, text) to authenticated;
grant execute on function exercise_group_counts(text[], text, text) to authenticated;
