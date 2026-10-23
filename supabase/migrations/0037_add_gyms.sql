-- Gyms (phase 2 of the trainer pilot): a gym signs up, invites its trainers and members, assigns
-- members to trainers, and sees who is training and who has gone quiet.
--
--   gyms          the gym; owner_id is the person who signed it up (deleting them deletes the gym)
--   gym_staff     admins (front desk, managers) and trainers, with history
--   gym_members   members, one active gym each, with history
--   gym_invites   join links: trainer and admin links last 14 days; member links (the front-desk QR
--                 poster) last until the gym makes a new one
--   trainer_clients.gym_id   set when the gym assigned that trainer; null for a private client
--
-- What a gym sees about a member is counts and dates only: name, trainer, joined, workouts this
-- week, last workout. Never their plans, sets, notes, body weight or profile details. A trainer the
-- gym assigns sees what any trainer sees (0034), because the member agreed to that when joining.
-- Like 0034, nothing here widens the existing row-level security on people's own data: gym reads
-- and writes go through SECURITY DEFINER functions that check the caller's role first.

create table gyms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  city text check (city is null or char_length(city) <= 60),
  area text check (area is null or char_length(area) <= 60),
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  created_at timestamptz not null default now()
);

create index gyms_owner_id_idx on gyms (owner_id);

create table gym_staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'trainer')),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  constraint gym_staff_ended_at check ((status = 'ended') = (ended_at is not null))
);

-- One active row per person and role at a gym (someone can be both an admin and a trainer).
create unique index gym_staff_one_active on gym_staff (gym_id, user_id, role) where status = 'active';
create index gym_staff_user_id_idx on gym_staff (user_id, status);
create index gym_staff_ended_by_idx on gym_staff (ended_by) where ended_by is not null;

create table gym_members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  constraint gym_members_ended_at check ((status = 'ended') = (ended_at is not null))
);

create unique index gym_members_one_active on gym_members (user_id) where status = 'active';
create index gym_members_gym_id_idx on gym_members (gym_id, status);
create index gym_members_ended_by_idx on gym_members (ended_by) where ended_by is not null;

create table gym_invites (
  code text primary key check (code ~ '^[a-z0-9]{10}$'),
  gym_id uuid not null references gyms(id) on delete cascade,
  role text not null check (role in ('admin', 'trainer', 'member')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- null: works until the gym makes a new link (member posters)
  expires_at timestamptz,
  revoked_at timestamptz
);

create index gym_invites_gym_id_idx on gym_invites (gym_id, role);
create index gym_invites_created_by_idx on gym_invites (created_by) where created_by is not null;

-- A gym being deleted turns its assigned trainer links into private ones rather than ending them:
-- the trainer and client agreed to work together, and either can still end it.
alter table trainer_clients add column gym_id uuid references gyms(id) on delete set null;
create index trainer_clients_gym_id_idx on trainer_clients (gym_id) where gym_id is not null;

alter table gyms enable row level security;
alter table gym_staff enable row level security;
alter table gym_members enable row level security;
alter table gym_invites enable row level security;

-- True when the signed-in person runs this gym: its owner, or one of its admins.
create function is_gym_admin(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from gyms where id = p_gym_id and owner_id = auth.uid())
    or exists (
      select 1 from gym_staff
      where gym_id = p_gym_id and user_id = auth.uid() and role = 'admin' and status = 'active'
    );
$$;

create function require_gym_admin(p_gym_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not is_gym_admin(p_gym_id) then
    raise exception 'Not an admin of this gym' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- The gym is readable by the people in it; its staff and member rows by the person themselves and
-- by the gym's admins. Everything is written through the functions below, except that admins can
-- edit the gym's details directly.
create policy "gyms read by its people" on gyms
  for select to authenticated using (
    owner_id = auth.uid()
    or exists (select 1 from gym_staff s where s.gym_id = gyms.id and s.user_id = auth.uid() and s.status = 'active')
    or exists (select 1 from gym_members m where m.gym_id = gyms.id and m.user_id = auth.uid() and m.status = 'active')
  );
create policy "gyms update by admins" on gyms
  for update to authenticated using (is_gym_admin(id)) with check (is_gym_admin(id));
create policy "gym_staff read own or as admin" on gym_staff
  for select to authenticated using (user_id = auth.uid() or is_gym_admin(gym_id));
create policy "gym_members read own or as admin" on gym_members
  for select to authenticated using (user_id = auth.uid() or is_gym_admin(gym_id));
create policy "gym_invites read as admin" on gym_invites
  for select to authenticated using (is_gym_admin(gym_id));

revoke all on gyms, gym_staff, gym_members, gym_invites from anon;

-- Ends a member's link with the trainer this gym assigned them, if any.
create function end_gym_trainer_link(p_gym_id uuid, p_member_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where client_id = p_member_id and gym_id = p_gym_id and status = 'active';
$$;

-- A new gym, run by the signed-in person.
create function create_gym(p_name text, p_city text, p_area text, p_phone text)
returns gyms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym gyms;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into gyms (owner_id, name, city, area, phone)
  values (auth.uid(), btrim(p_name), nullif(btrim(p_city), ''), nullif(btrim(p_area), ''), nullif(btrim(p_phone), ''))
  returning * into v_gym;
  return v_gym;
end;
$$;

-- A new join link of one kind for a gym; the gym's earlier link of that kind stops working.
create function create_gym_invite(p_gym_id uuid, p_role text)
returns gym_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
  v_bytes bytea;
  v_invite gym_invites;
begin
  perform require_gym_admin(p_gym_id);
  if p_role not in ('admin', 'trainer', 'member') then
    raise exception 'Invalid invite type';
  end if;
  -- Only the owner adds admins.
  if p_role = 'admin' and not exists (select 1 from gyms where id = p_gym_id and owner_id = auth.uid()) then
    raise exception 'Only the gym''s owner can add admins' using errcode = 'insufficient_privilege';
  end if;

  update gym_invites set revoked_at = now()
  where gym_id = p_gym_id and role = p_role and revoked_at is null;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % length(v_alphabet) + 1, 1);
    end loop;
    begin
      insert into gym_invites (code, gym_id, role, created_by, expires_at)
      values (v_code, p_gym_id, p_role, auth.uid(), case when p_role = 'member' then null else now() + interval '14 days' end)
      returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- Astronomically unlikely; try another code.
    end;
  end loop;
end;
$$;

-- What a gym join page shows before accepting. state: valid, expired (or replaced), not_found,
-- current (already in the gym in that role), or needs_trainer_profile (a trainer link opened by
-- someone who hasn't set up a trainer account yet).
create function gym_invite_details(p_code text)
returns table (state text, role text, gym_name text, city text, area text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite gym_invites;
  v_gym gyms;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_invite from gym_invites where code = lower(btrim(p_code));
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  select * into v_gym from gyms where id = v_invite.gym_id;
  return query select
    case
      when v_invite.role = 'member' and exists (
        select 1 from gym_members where gym_id = v_gym.id and user_id = auth.uid() and status = 'active') then 'current'
      when v_invite.role <> 'member' and exists (
        select 1 from gym_staff where gym_id = v_gym.id and user_id = auth.uid() and gym_staff.role = v_invite.role and status = 'active') then 'current'
      when v_invite.revoked_at is not null or v_invite.expires_at <= now() then 'expired'
      when v_invite.role = 'trainer' and not exists (select 1 from trainer_profiles where user_id = auth.uid()) then 'needs_trainer_profile'
      else 'valid'
    end,
    v_invite.role, v_gym.name, v_gym.city, v_gym.area;
end;
$$;

-- The signed-in person joins a gym by its link. A member's earlier gym membership ends (with the
-- trainer that gym assigned them). Joining again in the same role changes nothing.
create function accept_gym_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite gym_invites;
  v_old gym_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and onboarded) then
    raise exception 'Finish setting up your account first';
  end if;
  select * into v_invite from gym_invites where code = lower(btrim(p_code));
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invite link has expired or doesn''t exist';
  end if;

  if v_invite.role = 'member' then
    select * into v_old from gym_members where user_id = auth.uid() and status = 'active' for update;
    if found and v_old.gym_id = v_invite.gym_id then
      return 'member';
    end if;
    if found then
      update gym_members set status = 'ended', ended_at = now(), ended_by = auth.uid() where id = v_old.id;
      perform end_gym_trainer_link(v_old.gym_id, auth.uid());
    end if;
    insert into gym_members (gym_id, user_id) values (v_invite.gym_id, auth.uid());
    return 'member';
  end if;

  if v_invite.role = 'trainer' and not exists (select 1 from trainer_profiles where user_id = auth.uid()) then
    raise exception 'Set up your trainer account first';
  end if;
  if not exists (
    select 1 from gym_staff
    where gym_id = v_invite.gym_id and user_id = auth.uid() and role = v_invite.role and status = 'active'
  ) then
    insert into gym_staff (gym_id, user_id, role) values (v_invite.gym_id, auth.uid(), v_invite.role);
  end if;
  return v_invite.role;
end;
$$;

-- Leaving a gym, by the person themselves or by its admins. A member who leaves also loses the
-- trainer the gym assigned them; a trainer who leaves stops training the gym's members (their
-- private clients stay). The owner can't be removed this way.
create function end_gym_membership(p_gym_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    perform require_gym_admin(p_gym_id);
  end if;
  update gym_members set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where gym_id = p_gym_id and user_id = p_user_id and status = 'active';
  if not found then
    return false;
  end if;
  perform end_gym_trainer_link(p_gym_id, p_user_id);
  return true;
end;
$$;

create function end_gym_staff(p_gym_id uuid, p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    perform require_gym_admin(p_gym_id);
    -- Admins come and go by the owner's hand only.
    if p_role = 'admin' and not exists (select 1 from gyms where id = p_gym_id and owner_id = auth.uid()) then
      raise exception 'Only the gym''s owner can remove admins' using errcode = 'insufficient_privilege';
    end if;
  end if;
  update gym_staff set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where gym_id = p_gym_id and user_id = p_user_id and role = p_role and status = 'active';
  if not found then
    return false;
  end if;
  if p_role = 'trainer' then
    update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid()
    where trainer_id = p_user_id and gym_id = p_gym_id and status = 'active';
  end if;
  return true;
end;
$$;

-- The gym gives a member a trainer (or a different one). A member who found their own trainer
-- keeps them: the gym can only change trainers it assigned.
create function assign_gym_trainer(p_gym_id uuid, p_member_id uuid, p_trainer_id uuid)
returns trainer_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current trainer_clients;
  v_link trainer_clients;
begin
  perform require_gym_admin(p_gym_id);
  if not exists (select 1 from gym_members where gym_id = p_gym_id and user_id = p_member_id and status = 'active') then
    raise exception 'Not a member of this gym';
  end if;
  if not exists (
    select 1 from gym_staff s join trainer_profiles tp on tp.user_id = s.user_id
    where s.gym_id = p_gym_id and s.user_id = p_trainer_id and s.role = 'trainer' and s.status = 'active'
  ) then
    raise exception 'Not a trainer at this gym';
  end if;
  if p_member_id = p_trainer_id then
    raise exception 'A trainer can''t be their own client';
  end if;

  select * into v_current from trainer_clients where client_id = p_member_id and status = 'active' for update;
  if found and (v_current.gym_id is distinct from p_gym_id) then
    raise exception 'This member has their own trainer';
  end if;
  if found and v_current.trainer_id = p_trainer_id then
    return v_current;
  end if;
  if found then
    update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid() where id = v_current.id;
  end if;
  insert into trainer_clients (trainer_id, client_id, gym_id) values (p_trainer_id, p_member_id, p_gym_id)
  returning * into v_link;
  return v_link;
end;
$$;

create function unassign_gym_trainer(p_gym_id uuid, p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_gym_admin(p_gym_id);
  update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where client_id = p_member_id and gym_id = p_gym_id and status = 'active';
  return found;
end;
$$;

-- The gym's members list: counts and dates only. "This week" is Monday to Sunday and a workout is
-- a log with a performed set, both as in trainer_client_overview (0034), in the member's time zone.
-- trainer_name is only for a trainer the gym assigned; has_own_trainer says a member found their
-- own (who stays private to them).
create function gym_member_overview(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  joined_at timestamptz,
  trainer_id uuid,
  trainer_name text,
  has_own_trainer boolean,
  workouts_this_week int,
  last_workout_on date,
  member_today date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_gym_admin(p_gym_id);
  return query
  with members as (
    select m.user_id, m.started_at, p.first_name, p.last_name,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from gym_members m
    left join profiles p on p.id = m.user_id
    where m.gym_id = p_gym_id and m.status = 'active'
  ),
  performed as (
    select l.user_id, l.date
    from workout_logs l
    join members on members.user_id = l.user_id
    where l.date <= members.today
      and exists (
        select 1 from logged_exercises le
        join logged_sets s on s.logged_exercise_id = le.id
        where le.log_id = l.id and (s.reps is not null or s.weight is not null)
      )
  )
  select
    members.user_id,
    members.first_name,
    members.last_name,
    members.started_at,
    case when tc.gym_id = p_gym_id then tc.trainer_id end,
    case when tc.gym_id = p_gym_id then tp.display_name end,
    tc.id is not null and tc.gym_id is distinct from p_gym_id,
    (select count(*)::int from performed
      where performed.user_id = members.user_id
        and performed.date >= members.today - (extract(isodow from members.today)::int - 1)),
    (select max(performed.date) from performed where performed.user_id = members.user_id),
    members.today
  from members
  left join trainer_clients tc on tc.client_id = members.user_id and tc.status = 'active'
  left join trainer_profiles tp on tp.user_id = tc.trainer_id
  order by members.first_name nulls last, members.started_at;
end;
$$;

-- The gym's trainers: how many members each trains here, the plans they made or changed for them
-- this week (Monday to Sunday, in the trainer's time zone), and how many of those members haven't
-- worked out in 7 days or more.
create function gym_trainer_overview(p_gym_id uuid)
returns table (
  trainer_id uuid,
  display_name text,
  joined_at timestamptz,
  members_assigned int,
  plans_this_week int,
  members_inactive_7_days int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_gym_admin(p_gym_id);
  return query
  with trainers as (
    select s.user_id, s.started_at, tp.display_name,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from gym_staff s
    join trainer_profiles tp on tp.user_id = s.user_id
    left join profiles p on p.id = s.user_id
    where s.gym_id = p_gym_id and s.role = 'trainer' and s.status = 'active'
  ),
  assigned as (
    select tc.trainer_id, tc.client_id
    from trainer_clients tc
    where tc.gym_id = p_gym_id and tc.status = 'active'
  )
  select
    trainers.user_id,
    trainers.display_name,
    trainers.started_at,
    (select count(*)::int from assigned a where a.trainer_id = trainers.user_id),
    (select count(*)::int from workout_plans wp
      join assigned a on a.client_id = wp.user_id and a.trainer_id = trainers.user_id
      where (wp.created_by = trainers.user_id or wp.updated_by = trainers.user_id)
        and wp.date between trainers.today - (extract(isodow from trainers.today)::int - 1)
                        and trainers.today - (extract(isodow from trainers.today)::int - 1) + 6),
    (select count(*)::int from assigned a
      where a.trainer_id = trainers.user_id
        and not exists (
          select 1 from workout_logs l
          join logged_exercises le on le.log_id = l.id
          join logged_sets s on s.logged_exercise_id = le.id
          where l.user_id = a.client_id and l.date > trainers.today - 7 and l.date <= trainers.today
            and (s.reps is not null or s.weight is not null)
        ))
  from trainers
  order by trainers.display_name;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_gym_admin(uuid)',
    'create_gym(text, text, text, text)',
    'create_gym_invite(uuid, text)',
    'gym_invite_details(text)',
    'accept_gym_invite(text)',
    'end_gym_membership(uuid, uuid)',
    'end_gym_staff(uuid, uuid, text)',
    'assign_gym_trainer(uuid, uuid, uuid)',
    'unassign_gym_trainer(uuid, uuid)',
    'gym_member_overview(uuid)',
    'gym_trainer_overview(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Internal helpers: only called from the functions above.
revoke execute on function require_gym_admin(uuid) from public, anon, authenticated;
revoke execute on function end_gym_trainer_link(uuid, uuid) from public, anon, authenticated;
