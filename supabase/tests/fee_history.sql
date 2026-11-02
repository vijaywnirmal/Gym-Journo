-- Checks for migration 0044: a member's fee record outlasts their trainer and gym. It ends, keeps
-- the payee's name and its payments, stays readable by the member and nobody else, and only goes
-- when the member deletes their own account.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

-- T stops training C; D deletes their trainer account (client E); O's gym is deleted (member M).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fa01', 'fh-stops@example.test'),
  ('00000000-0000-0000-0000-00000000fa02', 'fh-deletes@example.test'),
  ('00000000-0000-0000-0000-00000000fa03', 'fh-owner@example.test'),
  ('00000000-0000-0000-0000-00000000fb01', 'fh-client@example.test'),
  ('00000000-0000-0000-0000-00000000fb02', 'fh-client2@example.test'),
  ('00000000-0000-0000-0000-00000000fb03', 'fh-member@example.test'),
  ('00000000-0000-0000-0000-00000000fb04', 'fh-other@example.test');
insert into trainer_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000fa01', 'Ravi'),
  ('00000000-0000-0000-0000-00000000fa02', 'Asha');
insert into gyms (id, owner_id, name) values
  ('00000000-0000-0000-0000-00000000fc01', '00000000-0000-0000-0000-00000000fa03', 'Iron Gym');
insert into trainer_clients (trainer_id, client_id) values
  ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-00000000fb01'),
  ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-00000000fb02');
insert into gym_members (gym_id, user_id) values
  ('00000000-0000-0000-0000-00000000fc01', '00000000-0000-0000-0000-00000000fb03');

insert into fees (id, trainer_id, gym_id, payer_id, amount, period_months, starts_on, paid_until) values
  ('00000000-0000-0000-0000-00000000fd01', '00000000-0000-0000-0000-00000000fa01', null, '00000000-0000-0000-0000-00000000fb01', 2000, 1, '2026-01-01', '2026-01-31'),
  ('00000000-0000-0000-0000-00000000fd02', '00000000-0000-0000-0000-00000000fa02', null, '00000000-0000-0000-0000-00000000fb02', 3000, 1, '2026-01-01', '2026-01-31'),
  ('00000000-0000-0000-0000-00000000fd03', null, '00000000-0000-0000-0000-00000000fc01', '00000000-0000-0000-0000-00000000fb03', 1500, 3, '2026-01-01', '2026-03-31');
insert into fee_payments (fee_id, amount, paid_on, method, covers_from, covers_until) values
  ('00000000-0000-0000-0000-00000000fd01', 2000, '2026-01-02', 'upi', '2026-01-01', '2026-01-31'),
  ('00000000-0000-0000-0000-00000000fd02', 3000, '2026-01-02', 'cash', '2026-01-01', '2026-01-31'),
  ('00000000-0000-0000-0000-00000000fd03', 1500, '2026-01-02', 'card', '2026-01-01', '2026-03-31');

do $$
begin
  if (select payee_name from fees where id = '00000000-0000-0000-0000-00000000fd01') is distinct from 'Ravi'
     or (select payee_name from fees where id = '00000000-0000-0000-0000-00000000fd03') is distinct from 'Iron Gym' then
    raise exception 'a new fee should record its payee''s name';
  end if;

  -- An active fee must always have exactly one payee.
  begin
    update fees set trainer_id = null where id = '00000000-0000-0000-0000-00000000fd01';
    raise exception 'an active fee must not lose its payee' using errcode = 'P0099';
  exception when check_violation then null;
  end;
end $$;

-- The trainer stops training.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000fa01","role":"authenticated"}', true);
select stop_training();
-- The other trainer's and the gym owner's accounts are deleted (as deleteAccount does).
delete from auth.users where id in ('00000000-0000-0000-0000-00000000fa02', '00000000-0000-0000-0000-00000000fa03');

do $$
declare
  f record;
begin
  for f in select * from fees where id in (
    '00000000-0000-0000-0000-00000000fd01', '00000000-0000-0000-0000-00000000fd02', '00000000-0000-0000-0000-00000000fd03'
  ) loop
    if f.status <> 'ended' or f.ended_at is null or f.trainer_id is not null or f.gym_id is not null then
      raise exception 'fee % should have ended with no payee, got % / % / %', f.id, f.status, f.trainer_id, f.gym_id;
    end if;
    if not exists (select 1 from fee_payments where fee_id = f.id) then
      raise exception 'fee % should keep its payments', f.id;
    end if;
  end loop;
  if (select count(*) from fees where id in (
    '00000000-0000-0000-0000-00000000fd01', '00000000-0000-0000-0000-00000000fd02', '00000000-0000-0000-0000-00000000fd03'
  )) <> 3 then
    raise exception 'all three fees should still exist';
  end if;
  if (select payee_name from fees where id = '00000000-0000-0000-0000-00000000fd02') is distinct from 'Asha' then
    raise exception 'the fee should keep the name of the trainer who left';
  end if;
end $$;

-- The member still reads their record; anyone else doesn't.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000fb01","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from fees) <> 1 or (select count(*) from fee_payments) <> 1 then
    raise exception 'the member should read their own past fee and its payment, and nothing else';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000fb04","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from fees) or exists (select 1 from fee_payments) then
    raise exception 'anyone else must not see a past fee';
  end if;
end $$;
reset role;

-- The member's own deletion still removes their record.
delete from auth.users where id = '00000000-0000-0000-0000-00000000fb01';
do $$
begin
  if exists (select 1 from fees where id = '00000000-0000-0000-0000-00000000fd01')
     or exists (select 1 from fee_payments where fee_id = '00000000-0000-0000-0000-00000000fd01') then
    raise exception 'deleting the member should delete their fee record';
  end if;
end $$;

rollback;
