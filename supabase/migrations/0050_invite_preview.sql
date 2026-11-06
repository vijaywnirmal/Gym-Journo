-- Who sent an invite link, for someone not signed in yet: the welcome page at /join/<code> and
-- /g/<code>, and the preview WhatsApp and others show for the link. Only for a link that still
-- works, and only what a trainer or gym already shows on its invite pages: a trainer's name, gym and
-- city (not their WhatsApp number), or a gym's name, area and city (not its phone number). Codes are
-- 10 random characters, so this can't be used to find links by guessing.
--
-- invite_link_state (0048) stays as it is: the proxy still uses it to turn dead links away.
create function invite_preview(p_kind text, p_code text)
returns table (state text, role text, name text, gym_name text, city text, area text)
language sql
stable
security definer
set search_path = public
as $$
  with link as (
    select 'trainer'::text as role, t.trainer_id as owner, null::uuid as gym, t.revoked_at, t.expires_at
    from trainer_invites t
    where p_kind = 'trainer' and t.code = lower(btrim(p_code))
    union all
    select g.role, null::uuid, g.gym_id, g.revoked_at, g.expires_at
    from gym_invites g
    where p_kind = 'gym' and g.code = lower(btrim(p_code))
  ),
  judged as (
    select link.*,
      case when revoked_at is not null or expires_at <= now() then 'expired' else 'open' end as state
    from link
  )
  select j.state,
    case when j.state = 'open' then j.role end,
    case when j.state = 'open' then coalesce(tp.display_name, gy.name) end,
    case when j.state = 'open' then tp.gym_name end,
    case when j.state = 'open' then coalesce(tp.city, gy.city) end,
    case when j.state = 'open' then gy.area end
  from judged j
  left join trainer_profiles tp on tp.user_id = j.owner
  left join gyms gy on gy.id = j.gym
  union all
  select 'not_found', null, null, null, null, null
  where not exists (select 1 from link);
$$;

revoke execute on function invite_preview(text, text) from public, authenticated;
grant execute on function invite_preview(text, text) to anon;
