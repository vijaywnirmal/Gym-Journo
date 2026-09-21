-- The person's IANA timezone (e.g. 'Asia/Kolkata'), taken from their device. It defines what "today"
-- means for them: which day a workout is logged on, where a week or a "last 14 days" window starts,
-- and when a future date is rejected. Null means not known yet (the app falls back to the server's
-- timezone). Validated in the app, not here — the set of IANA names is not something SQL checks.
-- Lives on profiles; the existing "profiles own" RLS policy already covers it.
alter table profiles add column timezone text;
