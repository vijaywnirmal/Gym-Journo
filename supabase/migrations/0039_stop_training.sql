-- A trainer stops training clients: their account goes back to being a member's (with its workout
-- journal), or stays a gym account if they also run a gym. Before this the only way out was
-- deleting the whole account.
--
-- What goes: the trainer profile, and with it (ON DELETE CASCADE, as when a trainer deletes their
-- account) their client links, invite links and open gym suggestions; their trainer role at any gym
-- ends. Clients lose access to nothing of their own: plans the trainer made stay on their calendar,
-- credited to a past trainer. Returns how many clients they were training.

create function stop_training()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clients int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from trainer_profiles where user_id = auth.uid()) then
    raise exception 'Not a trainer';
  end if;
  select count(*)::int into v_clients from trainer_clients where trainer_id = auth.uid() and status = 'active';
  update gym_staff set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where user_id = auth.uid() and role = 'trainer' and status = 'active';
  delete from trainer_profiles where user_id = auth.uid();
  return v_clients;
end;
$$;

revoke execute on function stop_training() from public, anon;
grant execute on function stop_training() to authenticated;
