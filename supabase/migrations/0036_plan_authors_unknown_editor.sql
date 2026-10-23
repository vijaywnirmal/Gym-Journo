-- Fix for 0035: a plan with no recorded editor never got one.
--
-- 0035 lets created_by / updated_by clear when the account they name is deleted, by checking that
-- no such account exists. With nothing recorded yet (plans from before 0034, or saved without a
-- session), that check is always true, so every later edit kept updated_by null: a trainer's change
-- to such a plan showed no "Changed by", and the pilot metrics missed it. The check now applies only
-- when a value was recorded.

create or replace function stamp_workout_plan_authors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    return new;
  end if;

  if old.created_by is not null and new.created_by is null
     and not exists (select 1 from auth.users where id = old.created_by) then
    new.created_by := null;
  else
    new.created_by := old.created_by;
  end if;

  if old.updated_by is not null and new.updated_by is null
     and not exists (select 1 from auth.users where id = old.updated_by) then
    new.updated_by := null;
  else
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

revoke execute on function stamp_workout_plan_authors() from public, anon, authenticated;
