-- Store date of birth instead of a static age, which drifts out of date.
-- The `age` column is left in place (unused by the app going forward) to avoid
-- discarding any data already recorded for existing users.
alter table profiles add column date_of_birth date;
