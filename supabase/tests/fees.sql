-- Checks for migration 0040 (fees): only a gym's admins set and record its members' fees, and only a
-- trainer their clients'; the payer sees their own and nobody else does; a payment covers the first
-- unpaid days and moves "paid until" on; the latest can be undone; and leaving the gym or the trainer
-- ends the fee while its history stays.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- O runs the gym; M and M2 are members; T trains C privately; X is anyone.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e0a0', 'fee-owner@example.test'),
  ('00000000-0000-0000-0000-00000000e0c1', 'fee-member@example.test'),
  ('00000000-0000-0000-0000-00000000e0c2', 'fee-member-2@example.test'),
  ('00000000-0000-0000-0000-00000000e0b1', 'fee-trainer@example.test'),
  ('00000000-0000-0000-0000-00000000e0d1', 'fee-client@example.test'),
  ('00000000-0000-0000-0000-00000000e0ee', 'fee-anyone@example.test');
insert into profiles (id, onboarded, first_name, timezone) values
  ('00000000-0000-0000-0000-00000000e0a0', true, 'Ola', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000e0c1', true, 'Mina', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000e0c2', true, 'Manu', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000e0b1', true, 'Tara', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000e0d1', true, 'Cara', 'Asia/Kolkata'),
  ('00000000-0000-0000-0000-00000000e0ee', true, 'Xia', 'Asia/Kolkata');
insert into trainer_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000e0b1', 'Tara');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-00000000e0b1', '00000000-0000-0000-0000-00000000e0d1');
insert into gyms (id, owner_id, name) values ('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0a0', 'Fee Gym');
insert into gym_members (gym_id, user_id) values
  ('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1'),
  ('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c2');

-- Signed out: nothing.
set local role anon;
do $$
begin
  begin
    perform 1 from fees;
    raise exception 'anon must not read fees' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1', 1500, 1, '2026-01-01');
    raise exception 'anon must not set a fee' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if has_table_privilege('authenticated', 'fees', 'insert') or has_table_privilege('authenticated', 'fee_payments', 'update')
     or has_function_privilege('authenticated', 'managed_fee(uuid)', 'execute') then
    raise exception 'fees must only be written through the functions';
  end if;
end $$;

-- O sets M's fee and records payments.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0a0","role":"authenticated"}', true);
do $$
declare
  v_fee fees;
  v_payment fee_payments;
begin
  v_fee := set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1', 1500, 1, '2026-01-01');
  if v_fee.amount <> 1500 or v_fee.paid_until is not null or v_fee.starts_on <> '2026-01-01' then
    raise exception 'the new fee is wrong: %', row_to_json(v_fee);
  end if;
  perform set_config('test.fee', v_fee.id::text, true);
  begin
    perform set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0ee', 1500, 1, '2026-01-01');
    raise exception 'only members can be charged' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%Not a member%' then raise; end if;
  end;

  v_payment := record_fee_payment(v_fee.id, 1500, '2026-01-03', 'cash', 1);
  if v_payment.covers_from <> '2026-01-01' or v_payment.covers_until <> '2026-01-31' then
    raise exception 'a first payment should cover the first month: %', row_to_json(v_payment);
  end if;
  v_payment := record_fee_payment(v_fee.id, 4500, '2026-02-02', 'upi', 3);
  if v_payment.covers_from <> '2026-02-01' or v_payment.covers_until <> '2026-04-30' then
    raise exception 'three months should run on from the last: %', row_to_json(v_payment);
  end if;
  perform set_config('test.payment_1', (select id::text from fee_payments where covers_from = '2026-01-01' and fee_id = v_fee.id), true);
  perform set_config('test.payment_2', v_payment.id::text, true);
  begin
    perform record_fee_payment(v_fee.id, 1500, current_date + 5, 'cash', 1);
    raise exception 'a payment can''t be dated in the future' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%future%' then raise; end if;
  end;
  begin
    perform record_fee_payment(v_fee.id, 1500, '2026-02-02', 'cash', 0);
    raise exception 'a payment must cover 1 to 12 periods' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%1 to 12%' then raise; end if;
  end;
end $$;
do $$
declare
  v_fee fees;
begin
  if (select paid_until from fees where id = current_setting('test.fee')::uuid) <> '2026-04-30' then
    raise exception 'paid_until should follow the payments';
  end if;
  -- Changing the amount once paid keeps the start date.
  v_fee := set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1', 1800, 1, '2026-03-01');
  if v_fee.id <> current_setting('test.fee')::uuid or v_fee.amount <> 1800 or v_fee.starts_on <> '2026-01-01' then
    raise exception 'changing a fee should update it in place: %', row_to_json(v_fee);
  end if;
  begin
    perform undo_fee_payment(current_setting('test.payment_1')::uuid);
    raise exception 'only the latest payment can be undone' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%latest%' then raise; end if;
  end;
  perform undo_fee_payment(current_setting('test.payment_2')::uuid);
end $$;
do $$
begin
  if (select paid_until from fees where id = current_setting('test.fee')::uuid) <> '2026-01-31'
     or (select count(*) from fee_payments where fee_id = current_setting('test.fee')::uuid) <> 1 then
    raise exception 'undoing should take paid_until back and remove the payment';
  end if;
end $$;

-- M sees their own fee and payments, and can't change them; X and T see nothing of it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0c1","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from fees) <> 1 or (select count(*) from fee_payments) <> 1 then
    raise exception 'the member should see their fee and its payment';
  end if;
  begin
    perform record_fee_payment(current_setting('test.fee')::uuid, 1500, '2026-02-02', 'cash', 1);
    raise exception 'a member must not record their own payment' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  begin
    perform set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1', 1, 1, '2026-01-01');
    raise exception 'a member must not set their own fee' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0ee","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from fees) or exists (select 1 from fee_payments) then
    raise exception 'anyone else must not see the fee';
  end if;
  begin
    perform end_fee(current_setting('test.fee')::uuid);
    raise exception 'anyone else must not end the fee' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T charges C; T can't charge a gym member who isn't their client, or see the gym's fees.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0b1","role":"authenticated"}', true);
do $$
declare
  v_fee fees;
  v_payment fee_payments;
begin
  v_fee := set_client_fee('00000000-0000-0000-0000-00000000e0d1', 4000, 3, '2026-01-15');
  v_payment := record_fee_payment(v_fee.id, 4000, '2026-01-15', 'upi', 1);
  if v_payment.covers_until <> '2026-04-14' then
    raise exception 'three months from Jan 15 should run to Apr 14: %', row_to_json(v_payment);
  end if;
  perform set_config('test.trainer_fee', v_fee.id::text, true);
  begin
    perform set_client_fee('00000000-0000-0000-0000-00000000e0c1', 4000, 3, '2026-01-15');
    raise exception 'a trainer must not charge someone who isn''t their client' using errcode = 'P0099';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from fees where gym_id is not null) then
    raise exception 'a trainer must not see the gym''s fees';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0a0","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from fees where trainer_id is not null) then
    raise exception 'the gym must not see a trainer''s fees';
  end if;
end $$;

-- C ends the trainer link and M leaves the gym: both fees end, their history stays.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0d1","role":"authenticated"}', true);
select end_trainer_link((select id from trainer_clients where client_id = '00000000-0000-0000-0000-00000000e0d1' and status = 'active'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0c1","role":"authenticated"}', true);
select end_gym_membership('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0b1","role":"authenticated"}', true);
do $$
begin
  if (select status from fees where id = current_setting('test.trainer_fee')::uuid) <> 'ended' then
    raise exception 'ending the trainer link should end its fee';
  end if;
  begin
    perform record_fee_payment(current_setting('test.trainer_fee')::uuid, 4000, '2026-04-15', 'upi', 1);
    raise exception 'an ended fee must not take payments' using errcode = 'P0099';
  exception when raise_exception then
    if sqlerrm not like '%ended%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e0a0","role":"authenticated"}', true);
do $$
declare
  v_fee fees;
begin
  if (select status from fees where id = current_setting('test.fee')::uuid) <> 'ended'
     or (select count(*) from fee_payments where fee_id = current_setting('test.fee')::uuid) <> 1 then
    raise exception 'leaving the gym should end the fee and keep its history';
  end if;
  -- The owner can also stop charging someone.
  v_fee := set_gym_member_fee('00000000-0000-0000-0000-00000000e0f0', '00000000-0000-0000-0000-00000000e0c2', 1500, 1, '2026-01-01');
  perform end_fee(v_fee.id);
  if (select status from fees where id = v_fee.id) <> 'ended' then
    raise exception 'end_fee should end the fee';
  end if;
end $$;

rollback;
