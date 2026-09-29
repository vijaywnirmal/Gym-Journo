-- Index every foreign-key column that had no index of its own.
--
-- Postgres indexes the referenced side of a foreign key (the primary key) but not the referencing
-- column. Without these, joining a parent to its children — log → exercises → sets, plan →
-- planned exercises, template → template exercises — scans the whole child table, and so does
-- the RLS policy on logged_sets, which joins through logged_exercises and workout_logs for every
-- row it checks. Deleting a parent (a plan, a custom exercise, a muscle group) also scans each
-- child table to cascade or null out references. That cost grows with every set anyone logs.
--
-- Columns already covered by a unique constraint or an earlier index are left alone
-- (e.g. workout_logs (user_id, date), recommendations (user_id, planned_exercise_id)).

-- Parent → child joins used by History, Progress, the logger, schedules and templates.
create index if not exists logged_exercises_log_id_idx on logged_exercises (log_id);
create index if not exists logged_sets_logged_exercise_id_idx on logged_sets (logged_exercise_id);
create index if not exists planned_exercises_plan_id_idx on planned_exercises (plan_id);
create index if not exists template_exercises_template_id_idx on template_exercises (template_id);

-- Per-exercise lookups (exercise history and progress).
create index if not exists logged_exercises_exercise_id_idx on logged_exercises (exercise_id);

-- Per-user lists filtered by RLS.
create index if not exists exercises_user_id_idx on exercises (user_id);
create index if not exists workout_templates_user_id_idx on workout_templates (user_id);

-- Referencing columns scanned when a parent row is deleted.
create index if not exists exercise_muscle_groups_muscle_group_id_idx on exercise_muscle_groups (muscle_group_id);
create index if not exists workout_plan_muscle_groups_muscle_group_id_idx on workout_plan_muscle_groups (muscle_group_id);
create index if not exists planned_exercises_exercise_id_idx on planned_exercises (exercise_id);
create index if not exists template_exercises_exercise_id_idx on template_exercises (exercise_id);
create index if not exists workout_logs_plan_id_idx on workout_logs (plan_id);
create index if not exists recommendations_exercise_id_idx on recommendations (exercise_id);
create index if not exists recommendations_planned_exercise_id_idx on recommendations (planned_exercise_id);
