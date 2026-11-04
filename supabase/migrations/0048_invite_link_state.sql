-- Whether an invite link still works, for someone not signed in yet, so a dead link can say so
-- before they create an account for nothing. Answers with the state alone: who sent the link stays
-- behind sign-in (trainer_invite_details, gym_invite_details). Codes are 10 random characters, so
-- this can't be used to find links by guessing.
create function invite_link_state(p_kind text, p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with link as (
    select revoked_at, expires_at from trainer_invites
    where p_kind = 'trainer' and code = lower(btrim(p_code))
    union all
    select revoked_at, expires_at from gym_invites
    where p_kind = 'gym' and code = lower(btrim(p_code))
  )
  select coalesce(
    (select case when revoked_at is not null or expires_at <= now() then 'expired' else 'open' end from link),
    'not_found'
  );
$$;

revoke execute on function invite_link_state(text, text) from public, authenticated;
grant execute on function invite_link_state(text, text) to anon;
