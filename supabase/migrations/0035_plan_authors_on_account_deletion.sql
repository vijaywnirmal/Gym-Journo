-- Fix for 0034: deleting an account that made plans for someone else failed.
--
-- workout_plans.created_by / updated_by clear themselves when that account is deleted (ON DELETE
-- SET NULL), but stamp_workout_plan_authors put the old value back on that update, so the foreign
-- key refused it and the whole account deletion failed (a trainer who had planned for a client
-- couldn't delete their account). Now a value is cleared exactly when the account it names is
-- gone; any other update still can't change or clear who made a plan.
--
-- SECURITY DEFINER so the check can read auth.users whoever is updating.

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

  if new.created_by is null and not exists (select 1 from auth.users where id = old.created_by) then
    new.created_by := null;
  else
    new.created_by := old.created_by;
  end if;

  if new.updated_by is null and not exists (select 1 from auth.users where id = old.updated_by) then
    new.updated_by := null;
  else
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

revoke execute on function stamp_workout_plan_authors() from public, anon, authenticated;
