-- Where the person usually trains, so quick workouts (src/lib/quickWorkouts.ts) only suggest
-- sessions and exercises they can do there:
--   gym             any equipment
--   home_dumbbells  dumbbells and bodyweight
--   bodyweight      no equipment
-- Optional: null (not answered) means no restriction, as before.
alter table profiles
  add column training_location text
  check (training_location is null or training_location in ('gym', 'home_dumbbells', 'bodyweight'));
