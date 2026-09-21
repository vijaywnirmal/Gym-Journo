-- Profile: separate first and last name, and gender (renamed from sex).
--
-- first_name / last_name are what the person edits; full_name stays as the joined display name so
-- the greeting and the AI plan keep reading a single name. Existing full names are split at the
-- first space ("Mary Ann Smith" -> first "Mary", last "Ann Smith") so nobody loses their name;
-- the person can correct the split from Profile.
--
-- sex -> gender is a plain rename: same data ('male' / 'female' / 'other'), new value
-- 'prefer_not_to_say' is written by the app going forward. No constraint existed on the column.
alter table profiles rename column sex to gender;

alter table profiles add column first_name text;
alter table profiles add column last_name text;

update profiles
set
  first_name = nullif(split_part(btrim(full_name), ' ', 1), ''),
  last_name = nullif(btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1)), '')
where full_name is not null and btrim(full_name) <> '';
