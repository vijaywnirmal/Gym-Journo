-- Coach consent: the person's explicit opt-in to sending their training evidence to an external
-- model (Google's Gemini). Null means no consent (the default); a timestamp records when it was
-- given. Withdrawing sets it back to null. Lives on profiles because it is a per-person setting
-- read alongside the rest of the profile; the existing "profiles own" RLS policy already covers it.
alter table profiles add column coach_consent_at timestamptz;
