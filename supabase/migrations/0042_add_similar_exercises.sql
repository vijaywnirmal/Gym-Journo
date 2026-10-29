-- Exercises that do the same job as a given one, for "Swap" in the logger: the exercises the
-- signed-in person can see (the shared library and their own, by row-level security) whose muscle
-- groups overlap the given exercise's by at least two thirds (shared groups / all groups of the two,
-- so bench press ↔ push-up qualifies, bench press ↔ tricep pushdown doesn't). exact = the same
-- muscle groups. The app ranks and filters them (src/lib/exerciseSwap.ts).

create function similar_exercises(p_exercise_id uuid)
returns table (id uuid, name text, equipment text, muscles text[], exact boolean)
language sql
stable
security invoker
set search_path = public
as $$
  with target as (
    select array_agg(emg.muscle_group_id) as ids
    from exercises e
    join exercise_muscle_groups emg on emg.exercise_id = e.id
    where e.id = p_exercise_id
  ),
  candidates as (
    select e.id, e.name, e.equipment,
      array_agg(mg.id) as ids,
      array_agg(mg.name order by mg.name) as muscles
    from exercises e
    join exercise_muscle_groups emg on emg.exercise_id = e.id
    join muscle_groups mg on mg.id = emg.muscle_group_id
    where e.id <> p_exercise_id
    group by e.id
  )
  select c.id, c.name, c.equipment, c.muscles, c.ids @> t.ids and t.ids @> c.ids
  from candidates c
  cross join target t
  where t.ids is not null
    and 3 * cardinality(array(select unnest(c.ids) intersect select unnest(t.ids)))
      >= 2 * cardinality(array(select unnest(c.ids) union select unnest(t.ids)))
  order by c.name, c.id;
$$;

revoke execute on function similar_exercises(uuid) from public, anon;
grant execute on function similar_exercises(uuid) to authenticated;
