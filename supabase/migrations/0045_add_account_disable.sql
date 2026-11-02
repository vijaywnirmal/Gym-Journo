-- Disabling an account: a gym owner with members can pause their account instead of deleting it,
-- which would take the gym and its member list with it. Set when disabled, null otherwise. The
-- person turns it back on by signing in; the "profiles own" policy already lets them change it.
alter table profiles add column disabled_at timestamptz;
