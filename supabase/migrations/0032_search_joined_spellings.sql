-- Exercise search: a word also matches the exercise's text with its spaces removed, so joined
-- spellings find hyphenated or two-word names ("pullup" -> "Pull-Up", "benchpress" -> "Bench
-- Press", "pushup", "chinup", "situp"). Otherwise unchanged from 0028.
create or replace function exercise_matches(p_exercise exercises, p_words text[], p_equipment text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with searchable as (
    select exercise_search_text(
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
    ) as text
  )
  select
    (p_equipment is null or lower(p_exercise.equipment) = lower(p_equipment))
    and (
      coalesce(cardinality(p_words), 0) = 0
      or not exists (
        select 1
        from unnest(p_words) as w(word), searchable s
        where position(w.word in s.text) = 0
          and position(w.word in replace(s.text, ' ', '')) = 0
      )
    );
$$;
