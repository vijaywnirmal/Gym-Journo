-- Allow a scheduled day to be marked as a rest day / planned absence instead of a workout
alter table workout_plans add column is_rest_day boolean not null default false;
