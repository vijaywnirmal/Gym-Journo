-- Adaptive Training / Coach C2 prerequisite: a planned exercise can now carry a target weight,
-- alongside the existing target_sets/target_reps — the field a future recommendation ("try 82.5 kg
-- next time") needs to write to. Templates get the same field, for the same reason 0008 gave them
-- target_sets/target_reps: a template is copied into a plan, so its shape must match.
--
-- Named target_weight/target_weight_unit, not target_weight_kg, matching logged_sets' own
-- weight/weight_unit columns — a unit-agnostic name so a value entered in lb is never sat in a
-- column whose name promises kg. target_weight_unit is not null even when target_weight is null:
-- a fixed, harmless default rather than a meaningless null.
alter table planned_exercises add column target_weight numeric;
alter table planned_exercises add column target_weight_unit text not null default 'kg';
alter table planned_exercises
  add constraint planned_exercises_target_weight_nonnegative check (target_weight is null or target_weight >= 0);

alter table template_exercises add column target_weight numeric;
alter table template_exercises add column target_weight_unit text not null default 'kg';
alter table template_exercises
  add constraint template_exercises_target_weight_nonnegative check (target_weight is null or target_weight >= 0);
