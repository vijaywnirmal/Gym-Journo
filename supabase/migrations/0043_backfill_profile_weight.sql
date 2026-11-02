-- One-time: bring profiles.weight_kg up to each person's newest body_measurements entry. Since the
-- app started keeping them in step (src/app/body/actions.ts) that only happens when a weight is
-- logged, so people who logged before then still showed their sign-up weight on Profile and in AI
-- plans. Anyone with no logged weight keeps what they have.
update profiles p
set weight_kg = newest.weight_kg, updated_at = now()
from (
  select distinct on (user_id) user_id, weight_kg
  from body_measurements
  order by user_id, date desc
) newest
where newest.user_id = p.id
  and p.weight_kg is distinct from newest.weight_kg;
