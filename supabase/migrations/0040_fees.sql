-- Membership fees, tracked (Gym Journal doesn't take payments): a gym sets what each member pays, a
-- trainer what each client pays, and either records payments as they come in (cash, UPI and so on).
-- The member sees the same record on Profile.
--
--   fees           one arrangement: who charges (a gym, or a trainer), who pays, how much (whole
--                  rupees) and how often (1, 3, 6 or 12 months), from when, and paid until when
--   fee_payments   what was paid, when, how, and which dates it covered; the latest can be undone
--
-- A fee ends by itself when the member leaves the gym or the trainer link ends (history stays), and
-- goes with the gym or the trainer account. Everything is written through the functions below,
-- which check the caller runs the gym (0037) or trains the client (0034).

create table fees (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms(id) on delete cascade,
  trainer_id uuid references trainer_profiles(user_id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount between 1 and 1000000),
  period_months int not null check (period_months in (1, 3, 6, 12)),
  -- The first day to pay for; paid_until is null until the first payment.
  starts_on date not null,
  paid_until date,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint fees_one_payee check ((gym_id is null) <> (trainer_id is null)),
  constraint fees_ended_at check ((status = 'ended') = (ended_at is not null)),
  constraint fees_not_self check (trainer_id is distinct from payer_id)
);

create unique index fees_one_active_gym on fees (gym_id, payer_id) where status = 'active' and gym_id is not null;
create unique index fees_one_active_trainer on fees (trainer_id, payer_id) where status = 'active' and trainer_id is not null;
create index fees_payer_id_idx on fees (payer_id);
create index fees_created_by_idx on fees (created_by) where created_by is not null;

create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references fees(id) on delete cascade,
  amount int not null check (amount between 1 and 10000000),
  paid_on date not null,
  method text not null check (method in ('cash', 'upi', 'card', 'bank', 'other')),
  covers_from date not null,
  covers_until date not null,
  -- What paid_until was before, so the latest payment can be undone.
  previous_paid_until date,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fee_payments_covers check (covers_until >= covers_from)
);

create index fee_payments_fee_id_idx on fee_payments (fee_id, covers_until desc);
create index fee_payments_recorded_by_idx on fee_payments (recorded_by) where recorded_by is not null;

alter table fees enable row level security;
alter table fee_payments enable row level security;

-- True when the signed-in person manages this fee: an admin of its gym, or its trainer.
create function can_manage_fee(p_fee fees)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_fee.gym_id is not null then is_gym_admin(p_fee.gym_id)
    else p_fee.trainer_id = auth.uid()
  end;
$$;

-- Read by whoever pays and whoever manages them; written only through the functions below.
create policy "fees read by payer or manager" on fees
  for select to authenticated using (payer_id = auth.uid() or can_manage_fee(fees));
create policy "fee_payments read with their fee" on fee_payments
  for select to authenticated using (
    exists (select 1 from fees f where f.id = fee_payments.fee_id and (f.payer_id = auth.uid() or can_manage_fee(f)))
  );

revoke all on fees, fee_payments from anon, authenticated;
grant select on fees, fee_payments to authenticated;

-- Locks and returns a fee the signed-in person manages, still active.
create function managed_fee(p_fee_id uuid)
returns fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_fee from fees where id = p_fee_id for update;
  if not found or not can_manage_fee(v_fee) then
    raise exception 'Not your fee to change' using errcode = 'insufficient_privilege';
  end if;
  if v_fee.status <> 'active' then
    raise exception 'This fee has ended';
  end if;
  return v_fee;
end;
$$;

-- Sets (or changes) what a fee charges. starts_on only moves while nothing has been paid.
create function save_fee(p_fee fees, p_amount int, p_period_months int, p_starts_on date)
returns fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
begin
  if p_fee.id is null then
    insert into fees (gym_id, trainer_id, payer_id, amount, period_months, starts_on, created_by)
    values (p_fee.gym_id, p_fee.trainer_id, p_fee.payer_id, p_amount, p_period_months, coalesce(p_starts_on, current_date), auth.uid())
    returning * into v_fee;
  else
    update fees set
      amount = p_amount,
      period_months = p_period_months,
      starts_on = case when paid_until is null then coalesce(p_starts_on, starts_on) else starts_on end,
      updated_at = now()
    where id = p_fee.id
    returning * into v_fee;
  end if;
  return v_fee;
end;
$$;

-- A gym sets what one of its members pays.
create function set_gym_member_fee(p_gym_id uuid, p_member_id uuid, p_amount int, p_period_months int, p_starts_on date)
returns fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
begin
  perform require_gym_admin(p_gym_id);
  -- Locked, so the member leaving waits for this (and then ends the fee).
  perform 1 from gym_members where gym_id = p_gym_id and user_id = p_member_id and status = 'active' for share;
  if not found then
    raise exception 'Not a member of this gym';
  end if;
  select * into v_fee from fees where gym_id = p_gym_id and payer_id = p_member_id and status = 'active' for update;
  if not found then
    v_fee.gym_id := p_gym_id;
    v_fee.payer_id := p_member_id;
  end if;
  return save_fee(v_fee, p_amount, p_period_months, p_starts_on);
end;
$$;

-- A trainer sets what one of their clients pays them.
create function set_client_fee(p_client_id uuid, p_amount int, p_period_months int, p_starts_on date)
returns fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform 1 from trainer_clients where trainer_id = auth.uid() and client_id = p_client_id and status = 'active' for share;
  if not found then
    raise exception 'Not this person''s trainer' using errcode = 'insufficient_privilege';
  end if;
  select * into v_fee from fees where trainer_id = auth.uid() and payer_id = p_client_id and status = 'active' for update;
  if not found then
    v_fee.trainer_id := auth.uid();
    v_fee.payer_id := p_client_id;
  end if;
  return save_fee(v_fee, p_amount, p_period_months, p_starts_on);
end;
$$;

-- Records a payment covering p_periods periods from the first unpaid day (so a late payment pays
-- the overdue period first), and moves paid_until on.
create function record_fee_payment(p_fee_id uuid, p_amount int, p_paid_on date, p_method text, p_periods int)
returns fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
  v_from date;
  v_until date;
  v_payment fee_payments;
begin
  v_fee := managed_fee(p_fee_id);
  if p_periods is null or p_periods not between 1 and 12 then
    raise exception 'Pay for 1 to 12 periods';
  end if;
  if p_paid_on is null or p_paid_on > current_date + 1 then
    raise exception 'The payment date can''t be in the future';
  end if;
  v_from := coalesce(v_fee.paid_until + 1, v_fee.starts_on);
  v_until := (v_from + make_interval(months => v_fee.period_months * p_periods))::date - 1;
  insert into fee_payments (fee_id, amount, paid_on, method, covers_from, covers_until, previous_paid_until, recorded_by)
  values (v_fee.id, p_amount, p_paid_on, p_method, v_from, v_until, v_fee.paid_until, auth.uid())
  returning * into v_payment;
  update fees set paid_until = v_until, updated_at = now() where id = v_fee.id;
  return v_payment;
end;
$$;

-- Undoes a fee's latest payment (a mistake): paid_until goes back to what it was.
create function undo_fee_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment fee_payments;
  v_fee fees;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_payment from fee_payments where id = p_payment_id;
  if not found then
    raise exception 'Not your fee to change' using errcode = 'insufficient_privilege';
  end if;
  v_fee := managed_fee(v_payment.fee_id);
  if exists (select 1 from fee_payments where fee_id = v_fee.id and covers_until > v_payment.covers_until) then
    raise exception 'Only the latest payment can be undone';
  end if;
  delete from fee_payments where id = v_payment.id;
  update fees set paid_until = v_payment.previous_paid_until, updated_at = now() where id = v_fee.id;
  return true;
end;
$$;

-- Stops charging a fee (its history stays).
create function end_fee(p_fee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee fees;
begin
  v_fee := managed_fee(p_fee_id);
  update fees set status = 'ended', ended_at = now(), updated_at = now() where id = v_fee.id;
  return true;
end;
$$;

-- A member leaving the gym, or a trainer link ending, ends the fee that went with it.
create function end_fees_with_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'gym_members' then
    update fees set status = 'ended', ended_at = now(), updated_at = now()
    where gym_id = new.gym_id and payer_id = new.user_id and status = 'active';
  else
    update fees set status = 'ended', ended_at = now(), updated_at = now()
    where trainer_id = new.trainer_id and payer_id = new.client_id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger gym_members_end_fees
  after update of status on gym_members
  for each row when (old.status = 'active' and new.status = 'ended')
  execute function end_fees_with_membership();
create trigger trainer_clients_end_fees
  after update of status on trainer_clients
  for each row when (old.status = 'active' and new.status = 'ended')
  execute function end_fees_with_membership();

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'set_gym_member_fee(uuid, uuid, int, int, date)',
    'set_client_fee(uuid, int, int, date)',
    'record_fee_payment(uuid, int, date, text, int)',
    'undo_fee_payment(uuid)',
    'end_fee(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Internal helpers: only called from the functions above. can_manage_fee stays callable by signed-in
-- people, because the read policies call it as them.
revoke execute on function managed_fee(uuid) from public, anon, authenticated;
revoke execute on function save_fee(fees, int, int, date) from public, anon, authenticated;
revoke execute on function end_fees_with_membership() from public, anon, authenticated;
revoke execute on function can_manage_fee(fees) from public, anon;
grant execute on function can_manage_fee(fees) to authenticated;
