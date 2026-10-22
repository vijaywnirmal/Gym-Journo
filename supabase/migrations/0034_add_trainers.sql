-- Trainers: a trainer invites clients, plans their weeks, and sees what they actually did.
--
--   trainer_profiles  having a row is what makes an account a trainer
--   trainer_invites   reusable join links (gymjourno.fit/join/<code>), 14 days, one live link each
--   trainer_clients   who trains whom; at most one active trainer per client, history kept
--   workout_plans.created_by / updated_by   who made and who last changed a plan ("Planned by")
--
-- Nothing here widens the existing per-user row-level security: a trainer reads and writes a
-- client's data only through the SECURITY DEFINER functions below, and each one checks for an
-- active link first. That keeps every existing query (Today, stats, Coach, AI plans) scoped to the
-- signed-in person's own rows, so a trainer's own journal never mixes in a client's data.
--
-- A trainer sees a client's plans, logs (including notes) and body weight, and their name, goal,
-- experience and training days. Never date of birth, height, gender, email, Coach, AI plans,
-- meals or reminders. The link only starts when the client accepts an invite, and either side can
-- end it at any time.

create table trainer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  gym_name text check (gym_name is null or char_length(gym_name) <= 80),
  city text check (city is null or char_length(city) <= 60),
  -- Digits with an optional leading +, e.g. +919876543210.
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{10,15}$'),
  created_at timestamptz not null default now()
);

create table trainer_invites (
  code text primary key check (code ~ '^[a-z0-9]{10}$'),
  trainer_id uuid not null references trainer_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz
);

create index trainer_invites_trainer_id_idx on trainer_invites (trainer_id);

create table trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainer_profiles(user_id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  constraint trainer_clients_not_self check (trainer_id <> client_id),
  constraint trainer_clients_ended_at check ((status = 'ended') = (ended_at is not null))
);

-- One trainer at a time per client; ended rows stay as the record of consent.
create unique index trainer_clients_one_active on trainer_clients (client_id) where status = 'active';
create index trainer_clients_trainer_id_idx on trainer_clients (trainer_id, status);
create index trainer_clients_ended_by_idx on trainer_clients (ended_by) where ended_by is not null;

alter table workout_plans
  add column created_by uuid references auth.users(id) on delete set null,
  add column updated_by uuid references auth.users(id) on delete set null;

create index workout_plans_created_by_idx on workout_plans (created_by) where created_by is not null;
create index workout_plans_updated_by_idx on workout_plans (updated_by) where updated_by is not null;

-- Who made and who last changed a plan, stamped from the session so the app can't forge it. Covers
-- every write path (save_workout_plan, apply_program, the client functions below). Writes without
-- a session (service role) leave the previous value.
create function stamp_workout_plan_authors()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  else
    new.created_by := old.created_by;
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

create trigger workout_plans_stamp_authors
  before insert or update on workout_plans
  for each row execute function stamp_workout_plan_authors();

alter table trainer_profiles enable row level security;
alter table trainer_invites enable row level security;
alter table trainer_clients enable row level security;

-- A trainer manages their own profile; their current clients can read it (the "Your trainer" card).
-- No delete: a trainer profile goes with the account, so the link history isn't lost.
create policy "trainer_profiles read own or my trainer" on trainer_profiles
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from trainer_clients tc
      where tc.trainer_id = trainer_profiles.user_id and tc.client_id = auth.uid() and tc.status = 'active'
    )
  );
create policy "trainer_profiles insert own" on trainer_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "trainer_profiles update own" on trainer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Invites and links are read directly but only written through the functions below.
create policy "trainer_invites read own" on trainer_invites
  for select to authenticated using (trainer_id = auth.uid());
create policy "trainer_clients read own" on trainer_clients
  for select to authenticated using (trainer_id = auth.uid() or client_id = auth.uid());

revoke all on trainer_profiles, trainer_invites, trainer_clients from anon;

-- True when the signed-in person is this client's trainer right now.
create function is_trainer_of(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trainer_clients
    where trainer_id = auth.uid() and client_id = p_client_id and status = 'active'
  );
$$;

create function require_trainer_of(p_client_id uuid)
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
  if not is_trainer_of(p_client_id) then
    raise exception 'Not this person''s trainer' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- A new join link for the signed-in trainer. Earlier links stop working, so "Make a new link" is
-- also how a leaked link is cancelled.
create function create_trainer_invite()
returns trainer_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No 0/o, 1/l/i: the code may be read out or typed from a screenshot.
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
  v_bytes bytea;
  v_invite trainer_invites;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from trainer_profiles where user_id = auth.uid()) then
    raise exception 'Not a trainer' using errcode = 'insufficient_privilege';
  end if;

  update trainer_invites set revoked_at = now()
  where trainer_id = auth.uid() and revoked_at is null and expires_at > now();

  loop
    v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % length(v_alphabet) + 1, 1);
    end loop;
    begin
      insert into trainer_invites (code, trainer_id) values (v_code, auth.uid()) returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      -- Astronomically unlikely; try another code.
    end;
  end loop;
end;
$$;

-- True when this trainer is the signed-in person's trainer right now.
create function is_trainer_of_me(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trainer_clients
    where trainer_id = p_trainer_id and client_id = auth.uid() and status = 'active'
  );
$$;

-- What the join page shows before the client accepts. state is one of:
--   valid, expired (or replaced by a newer link), not_found, own (the trainer's own link),
--   current (already training with this trainer).
create function trainer_invite_details(p_code text)
returns table (state text, display_name text, gym_name text, city text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite trainer_invites;
  v_profile trainer_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_invite from trainer_invites where code = lower(btrim(p_code));
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text;
    return;
  end if;
  select * into v_profile from trainer_profiles where user_id = v_invite.trainer_id;
  return query select
    case
      when v_invite.trainer_id = auth.uid() then 'own'
      when is_trainer_of_me(v_invite.trainer_id) then 'current'
      when v_invite.revoked_at is not null or v_invite.expires_at <= now() then 'expired'
      else 'valid'
    end,
    v_profile.display_name, v_profile.gym_name, v_profile.city;
end;
$$;

-- The client accepts: any other trainer link ends, and this one starts. Accepting the trainer
-- you already have changes nothing. Only finished accounts can accept (onboarding is where a
-- person confirms they're 18 or older).
create function accept_trainer_invite(p_code text)
returns trainer_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite trainer_invites;
  v_link trainer_clients;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and onboarded) then
    raise exception 'Finish setting up your account first';
  end if;

  select * into v_invite from trainer_invites where code = lower(btrim(p_code));
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invite link has expired or doesn''t exist';
  end if;
  if v_invite.trainer_id = auth.uid() then
    raise exception 'This is your own invite link';
  end if;

  select * into v_link from trainer_clients
  where client_id = auth.uid() and status = 'active'
  for update;
  if found and v_link.trainer_id = v_invite.trainer_id then
    return v_link;
  end if;

  update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where client_id = auth.uid() and status = 'active';

  insert into trainer_clients (trainer_id, client_id) values (v_invite.trainer_id, auth.uid())
  returning * into v_link;
  return v_link;
end;
$$;

-- Either side ends the link. The trainer loses access at once; plans they made stay with the
-- client. Returns false when there was no active link to end.
create function end_trainer_link(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update trainer_clients set status = 'ended', ended_at = now(), ended_by = auth.uid()
  where id = p_link_id and status = 'active' and (trainer_id = auth.uid() or client_id = auth.uid());
  return found;
end;
$$;

-- Exercises a trainer may put in a client's plan: the shared library and the client's own.
create function require_client_exercises(p_client_id uuid, p_exercise_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from unnest(coalesce(p_exercise_ids, '{}'::uuid[])) as x(id)
    where not exists (
      select 1 from exercises e where e.id = x.id and (e.user_id is null or e.user_id = p_client_id)
    )
  ) then
    raise exception 'Unknown exercise';
  end if;
end;
$$;

-- save_workout_plan (0029), run by the client's trainer for the client. Whether a day off was
-- marked late is judged in the client's time zone. The trigger records the trainer as the author.
create function save_client_plan(
  p_client_id uuid,
  p_date date,
  p_title text,
  p_off_kind text,
  p_muscle_group_ids uuid[],
  p_exercises jsonb
) returns workout_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing workout_plans;
  v_client_today date;
  v_marked_late boolean;
  v_plan workout_plans;
  v_exercise jsonb;
begin
  perform require_trainer_of(p_client_id);
  if p_off_kind is not null and p_off_kind not in ('rest', 'absence') then
    raise exception 'Invalid day type';
  end if;
  if jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) > 50 then
    raise exception 'Too many exercises';
  end if;
  perform require_client_exercises(
    p_client_id,
    array(select (e ->> 'exercise_id')::uuid from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) as e)
  );

  select (now() at time zone timezone_or_utc(timezone))::date into v_client_today
  from profiles where id = p_client_id;
  v_client_today := coalesce(v_client_today, (now() at time zone 'UTC')::date);

  select * into v_existing from workout_plans where user_id = p_client_id and date = p_date;
  v_marked_late := case
    when p_off_kind is null then false
    when v_existing.off_kind is not distinct from p_off_kind then coalesce(v_existing.off_marked_late, false)
    else p_date < v_client_today
  end;

  insert into workout_plans (user_id, date, title, is_rest_day, off_kind, off_marked_late)
  values (p_client_id, p_date, p_title, p_off_kind is not null, p_off_kind, v_marked_late)
  on conflict (user_id, date) do update set
    title = excluded.title,
    is_rest_day = excluded.is_rest_day,
    off_kind = excluded.off_kind,
    off_marked_late = excluded.off_marked_late
  returning * into v_plan;

  delete from workout_plan_muscle_groups where plan_id = v_plan.id;
  delete from planned_exercises where plan_id = v_plan.id;

  if p_off_kind is null then
    insert into workout_plan_muscle_groups (plan_id, muscle_group_id)
    select v_plan.id, mg_id from unnest(coalesce(p_muscle_group_ids, '{}'::uuid[])) as mg_id;

    for v_exercise in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
    loop
      insert into planned_exercises (
        plan_id, exercise_id, position, target_sets, target_reps, target_weight, target_weight_unit
      )
      values (
        v_plan.id,
        (v_exercise ->> 'exercise_id')::uuid,
        (v_exercise ->> 'position')::int,
        nullif(v_exercise ->> 'target_sets', '')::int,
        nullif(v_exercise ->> 'target_reps', '')::int,
        nullif(v_exercise ->> 'target_weight', '')::numeric,
        coalesce(nullif(v_exercise ->> 'target_weight_unit', ''), 'kg')
      );
    end loop;
  end if;

  return v_plan;
end;
$$;

-- Removes one planned day of the client's. Returns false when there was nothing planned.
create function delete_client_plan(p_client_id uuid, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  delete from workout_plans where user_id = p_client_id and date = p_date;
  return found;
end;
$$;

-- apply_program (0022) for a client: days that already have a plan are skipped, never overwritten.
-- Returns how many plans were created.
create function apply_program_for_client(p_client_id uuid, p_plans jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan jsonb;
  v_plan_id uuid;
  v_exercise jsonb;
  v_created integer := 0;
begin
  perform require_trainer_of(p_client_id);
  if jsonb_array_length(coalesce(p_plans, '[]'::jsonb)) > 200 then
    raise exception 'Too many plans';
  end if;
  perform require_client_exercises(
    p_client_id,
    array(
      select (e ->> 'exercise_id')::uuid
      from jsonb_array_elements(coalesce(p_plans, '[]'::jsonb)) as p,
           jsonb_array_elements(coalesce(p -> 'exercises', '[]'::jsonb)) as e
    )
  );

  for v_plan in select * from jsonb_array_elements(coalesce(p_plans, '[]'::jsonb))
  loop
    insert into workout_plans (user_id, date, title, is_rest_day)
    values (p_client_id, (v_plan ->> 'date')::date, v_plan ->> 'title', false)
    on conflict (user_id, date) do nothing
    returning id into v_plan_id;

    continue when v_plan_id is null;
    v_created := v_created + 1;

    insert into workout_plan_muscle_groups (plan_id, muscle_group_id)
    select v_plan_id, mg_id::uuid
    from jsonb_array_elements_text(coalesce(v_plan -> 'muscle_group_ids', '[]'::jsonb)) as mg_id
    on conflict do nothing;

    for v_exercise in select * from jsonb_array_elements(coalesce(v_plan -> 'exercises', '[]'::jsonb))
    loop
      insert into planned_exercises (plan_id, exercise_id, position, target_sets, target_reps)
      values (
        v_plan_id,
        (v_exercise ->> 'exercise_id')::uuid,
        (v_exercise ->> 'position')::int,
        nullif(v_exercise ->> 'target_sets', '')::int,
        nullif(v_exercise ->> 'target_reps', '')::int
      );
    end loop;
  end loop;

  return v_created;
end;
$$;

-- The trainer's dashboard: one row per current client. "Today" and "this week" (Monday to Sunday)
-- are the client's, in their time zone. A done day is a log with at least one performed set (reps
-- or weight recorded), as in performed_workout_dates (0026).
create function trainer_client_overview()
returns table (
  link_id uuid,
  client_id uuid,
  first_name text,
  last_name text,
  primary_goal text,
  experience_level text,
  training_days_per_week int,
  started_at timestamptz,
  client_today date,
  today_plan text,
  today_done boolean,
  planned_this_week int,
  done_this_week int,
  last_workout_on date,
  latest_weight_kg numeric,
  latest_weight_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with clients as (
    select tc.id, tc.client_id, tc.started_at, p.first_name, p.last_name, p.primary_goal,
      p.experience_level, p.training_days_per_week,
      (now() at time zone timezone_or_utc(p.timezone))::date as today
    from trainer_clients tc
    left join profiles p on p.id = tc.client_id
    where tc.trainer_id = auth.uid() and tc.status = 'active'
  ),
  links as (
    select clients.*, today - (extract(isodow from today)::int - 1) as week_start from clients
  ),
  performed as (
    select l.user_id, l.date
    from workout_logs l
    join links on links.client_id = l.user_id
    where l.date <= links.today
      and exists (
        select 1 from logged_exercises le
        join logged_sets s on s.logged_exercise_id = le.id
        where le.log_id = l.id and (s.reps is not null or s.weight is not null)
      )
  )
  select
    links.id,
    links.client_id,
    links.first_name,
    links.last_name,
    links.primary_goal,
    links.experience_level,
    links.training_days_per_week,
    links.started_at,
    links.today,
    (select coalesce(wp.off_kind, 'workout') from workout_plans wp
      where wp.user_id = links.client_id and wp.date = links.today),
    exists (select 1 from performed where performed.user_id = links.client_id and performed.date = links.today),
    (select count(*)::int from workout_plans wp
      where wp.user_id = links.client_id and not wp.is_rest_day
        and wp.date between links.week_start and links.week_start + 6),
    (select count(*)::int from performed
      where performed.user_id = links.client_id and performed.date >= links.week_start),
    (select max(performed.date) from performed where performed.user_id = links.client_id),
    bw.weight_kg,
    bw.date
  from links
  left join lateral (
    select b.weight_kg, b.date from body_measurements b
    where b.user_id = links.client_id order by b.date desc limit 1
  ) bw on true
  order by links.first_name nulls last, links.started_at;
$$;

-- A client's plans in [p_from, p_to] (at most 120 days), as JSON, oldest first:
-- [{id, date, title, is_rest_day, off_kind, off_marked_late, created_by, updated_by,
--   muscle_group_ids, exercises: [{id, exercise_id, name, equipment, position, target_sets,
--   target_reps, target_weight, target_weight_unit}]}]
create function client_plans(p_client_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'Choose a range of up to 120 days';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', wp.id,
      'date', wp.date,
      'title', wp.title,
      'is_rest_day', wp.is_rest_day,
      'off_kind', wp.off_kind,
      'off_marked_late', wp.off_marked_late,
      'created_by', wp.created_by,
      'updated_by', wp.updated_by,
      'muscle_group_ids', coalesce((
        select jsonb_agg(pmg.muscle_group_id) from workout_plan_muscle_groups pmg where pmg.plan_id = wp.id
      ), '[]'::jsonb),
      'exercises', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pe.id,
          'exercise_id', pe.exercise_id,
          'name', e.name,
          'equipment', e.equipment,
          'position', pe.position,
          'target_sets', pe.target_sets,
          'target_reps', pe.target_reps,
          'target_weight', pe.target_weight,
          'target_weight_unit', pe.target_weight_unit
        ) order by pe.position)
        from planned_exercises pe join exercises e on e.id = pe.exercise_id
        where pe.plan_id = wp.id
      ), '[]'::jsonb)
    ) order by wp.date)
    from workout_plans wp
    where wp.user_id = p_client_id and wp.date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- A client's logs in [p_from, p_to] (at most 120 days), as JSON, oldest first:
-- [{id, date, plan_id, notes, completed_at, exercises: [{exercise_id, name, position, notes,
--   sets: [{set_number, reps, weight, weight_unit, set_type, rpe, notes}]}]}]
create function client_logs(p_client_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'Choose a range of up to 120 days';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'date', l.date,
      'plan_id', l.plan_id,
      'notes', l.notes,
      'completed_at', l.completed_at,
      'exercises', coalesce((
        select jsonb_agg(jsonb_build_object(
          'exercise_id', le.exercise_id,
          'name', e.name,
          'position', le.position,
          'notes', le.notes,
          'sets', coalesce((
            select jsonb_agg(jsonb_build_object(
              'set_number', s.set_number,
              'reps', s.reps,
              'weight', s.weight,
              'weight_unit', s.weight_unit,
              'set_type', s.set_type,
              'rpe', s.rpe,
              'notes', s.notes
            ) order by s.set_number)
            from logged_sets s where s.logged_exercise_id = le.id
          ), '[]'::jsonb)
        ) order by le.position)
        from logged_exercises le join exercises e on e.id = le.exercise_id
        where le.log_id = l.id
      ), '[]'::jsonb)
    ) order by l.date)
    from workout_logs l
    where l.user_id = p_client_id and l.date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- A client's body weight entries in [p_from, p_to], oldest first. Notes stay private.
create function client_body_weights(p_client_id uuid, p_from date, p_to date)
returns table (date date, weight_kg numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  return query
    select b.date, b.weight_kg from body_measurements b
    where b.user_id = p_client_id and b.date between p_from and p_to
    order by b.date;
end;
$$;

-- The client's own custom exercises, for the trainer's exercise picker and for names in their logs.
create function client_custom_exercises(p_client_id uuid)
returns table (id uuid, name text, equipment text, muscle_group_ids uuid[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform require_trainer_of(p_client_id);
  return query
    select e.id, e.name, e.equipment,
      coalesce(array(select emg.muscle_group_id from exercise_muscle_groups emg where emg.exercise_id = e.id), '{}')
    from exercises e
    where e.user_id = p_client_id
    order by e.name;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_trainer_of(uuid)',
    'is_trainer_of_me(uuid)',
    'create_trainer_invite()',
    'trainer_invite_details(text)',
    'accept_trainer_invite(text)',
    'end_trainer_link(uuid)',
    'save_client_plan(uuid, date, text, text, uuid[], jsonb)',
    'delete_client_plan(uuid, date)',
    'apply_program_for_client(uuid, jsonb)',
    'trainer_client_overview()',
    'client_plans(uuid, date, date)',
    'client_logs(uuid, date, date)',
    'client_body_weights(uuid, date, date)',
    'client_custom_exercises(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Internal helpers: only called from the functions above.
revoke execute on function stamp_workout_plan_authors() from public, anon, authenticated;
revoke execute on function require_trainer_of(uuid) from public, anon, authenticated;
revoke execute on function require_client_exercises(uuid, uuid[]) from public, anon, authenticated;
