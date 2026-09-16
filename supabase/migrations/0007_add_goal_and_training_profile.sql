-- Phase 2: structured current goal + minimal training profile, replacing the free-text `goal`.
alter table profiles add column primary_goal text;
alter table profiles add column experience_level text;
alter table profiles add column training_days_per_week int;
alter table profiles add column target_weight_kg numeric;

-- Backfill known free-text goal values into the new enum-like column. Unknown/unrecognized
-- values are intentionally left null rather than guessed.
update profiles set primary_goal = 'build_muscle' where goal = 'Build muscle';
update profiles set primary_goal = 'lose_fat' where goal = 'Lose fat';
update profiles set primary_goal = 'maintain' where goal = 'Maintain';
update profiles set primary_goal = 'general_fitness' where goal = 'General fitness';

-- The old free-text column is fully superseded by primary_goal and has no other consumers
-- (verified: only used by the profile edit form and the AI-plan prompt, both updated in Phase 2).
alter table profiles drop column goal;
