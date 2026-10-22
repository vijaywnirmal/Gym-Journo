-- Checks for migration 0031: people can read and add their own AI plans and Coach records, but not
-- edit or delete them (that would reset the daily AI limits), and never see someone else's.
--
--   npm run test:sql
-- Everything happens in one transaction that is rolled back. A failed check raises an exception
-- naming it.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000aa001', 'ai-a@example.test'),
  ('00000000-0000-0000-0000-0000000bb002', 'ai-b@example.test');

insert into ai_plans (user_id, plan_markdown) values
  ('00000000-0000-0000-0000-0000000aa001', 'plan A'),
  ('00000000-0000-0000-0000-0000000bb002', 'plan B');
insert into coach_replies (user_id, question, evidence, status) values
  ('00000000-0000-0000-0000-0000000aa001', 'q A', '{}', 'accepted'),
  ('00000000-0000-0000-0000-0000000bb002', 'q B', '{}', 'accepted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000aa001","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from ai_plans) <> 1 or (select count(*) from coach_replies) <> 1 then
    raise exception 'A should see only its own AI plan and Coach record';
  end if;

  insert into ai_plans (user_id, plan_markdown) values ('00000000-0000-0000-0000-0000000aa001', 'plan A2');
  insert into coach_replies (user_id, question, evidence, status)
    values ('00000000-0000-0000-0000-0000000aa001', 'q A2', '{}', 'blocked');
  if (select count(*) from ai_plans) <> 2 or (select count(*) from coach_replies) <> 2 then
    raise exception 'A should be able to add its own rows';
  end if;

  delete from ai_plans;
  delete from coach_replies;
  if (select count(*) from ai_plans) <> 2 or (select count(*) from coach_replies) <> 2 then
    raise exception 'A must not be able to delete its rows (it would reset the daily limits)';
  end if;

  update ai_plans set created_at = '2000-01-01';
  update coach_replies set created_at = '2000-01-01';
  if exists (select 1 from ai_plans where created_at < '2001-01-01')
     or exists (select 1 from coach_replies where created_at < '2001-01-01') then
    raise exception 'A must not be able to backdate its rows (it would reset the daily limits)';
  end if;

  begin
    insert into ai_plans (user_id, plan_markdown) values ('00000000-0000-0000-0000-0000000bb002', 'forged');
    raise exception 'A must not be able to add a plan for B';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
begin
  if (select count(*) from ai_plans where user_id = '00000000-0000-0000-0000-0000000bb002') <> 1 then
    raise exception 'B''s plan should be untouched';
  end if;
end $$;

rollback;
