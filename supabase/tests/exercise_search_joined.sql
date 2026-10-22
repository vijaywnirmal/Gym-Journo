-- Checks for migration 0032: exercise search finds hyphenated and two-word names from their joined
-- spellings, and still requires every word to match.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into muscle_groups (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'Zz Joined Group');
insert into exercises (id, user_id, name, equipment) values
  ('00000000-0000-0000-0000-00000000e001', null, 'Zz Pull-Up Wide Grip', 'Bodyweight'),
  ('00000000-0000-0000-0000-00000000e002', null, 'Zz Bench Press Close', 'Barbell');
insert into exercise_muscle_groups (exercise_id, muscle_group_id)
select id, '00000000-0000-0000-0000-0000000000e1' from exercises
where id in ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000e002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

do $$
declare
  found text[];
begin
  select array_agg(name order by name) into found
    from browse_exercises('00000000-0000-0000-0000-0000000000e1', array['pullup'], null, null, null, 10);
  if found is distinct from array['Zz Pull-Up Wide Grip'] then
    raise exception 'pullup should find Zz Pull-Up Wide Grip, got %', found;
  end if;

  select array_agg(name order by name) into found
    from browse_exercises('00000000-0000-0000-0000-0000000000e1', array['benchpress'], null, null, null, 10);
  if found is distinct from array['Zz Bench Press Close'] then
    raise exception 'benchpress should find Zz Bench Press Close, got %', found;
  end if;

  select array_agg(name order by name) into found
    from browse_exercises('00000000-0000-0000-0000-0000000000e1', array['pullup', 'barbell'], null, null, null, 10);
  if found is not null then
    raise exception 'every word must still match: pullup + barbell should find nothing, got %', found;
  end if;
end $$;

rollback;
