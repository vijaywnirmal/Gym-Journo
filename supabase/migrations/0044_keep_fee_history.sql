-- Fee records outlast the gym or trainer they were with. Until now, a trainer stopping (0039) or
-- deleting their account, or a gym being deleted, cascaded through fees to fee_payments and erased
-- the record from the member who paid. Now the fee ends, keeps the payee's name, and stays with the
-- member; the member's own account deletion still removes it (payer_id cascades).
--
--   fees.payee_name   the gym's or trainer's name, kept for after they've gone (and for an ended
--                     trainer link, whose profile the member can no longer read)

alter table fees add column payee_name text;

update fees f
set payee_name = coalesce(
  (select g.name from gyms g where g.id = f.gym_id),
  (select tp.display_name from trainer_profiles tp where tp.user_id = f.trainer_id)
);

create function set_fee_payee_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.payee_name := coalesce(
    (select g.name from gyms g where g.id = new.gym_id),
    (select tp.display_name from trainer_profiles tp where tp.user_id = new.trainer_id)
  );
  return new;
end;
$$;

create trigger fees_set_payee_name
  before insert on fees
  for each row execute function set_fee_payee_name();

-- A payee can now be gone, but only from a fee that has ended.
alter table fees drop constraint fees_one_payee;
alter table fees add constraint fees_one_payee check (
  (gym_id is null or trainer_id is null)
  and (status = 'ended' or (gym_id is null) <> (trainer_id is null))
);

alter table fees drop constraint fees_gym_id_fkey;
alter table fees add constraint fees_gym_id_fkey
  foreign key (gym_id) references gyms(id) on delete set null;
alter table fees drop constraint fees_trainer_id_fkey;
alter table fees add constraint fees_trainer_id_fkey
  foreign key (trainer_id) references trainer_profiles(user_id) on delete set null;

-- Runs before the foreign keys clear the payee, so an active fee is ended first.
create function end_fees_of_departing_payee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'gyms' then
    update fees set status = 'ended', ended_at = now(), updated_at = now()
    where gym_id = old.id and status = 'active';
  else
    update fees set status = 'ended', ended_at = now(), updated_at = now()
    where trainer_id = old.user_id and status = 'active';
  end if;
  return old;
end;
$$;

create trigger gyms_end_fees
  before delete on gyms
  for each row execute function end_fees_of_departing_payee();
create trigger trainer_profiles_end_fees
  before delete on trainer_profiles
  for each row execute function end_fees_of_departing_payee();

-- A fee with no payee left has no manager (false, not null, so read policies and checks agree).
create or replace function can_manage_fee(p_fee fees)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_fee.gym_id is not null then is_gym_admin(p_fee.gym_id)
    else coalesce(p_fee.trainer_id = auth.uid(), false)
  end;
$$;

revoke execute on function set_fee_payee_name() from public, anon, authenticated;
revoke execute on function end_fees_of_departing_payee() from public, anon, authenticated;
