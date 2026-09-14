-- Seed muscle groups and a starter exercise library (global, user_id is null)

insert into muscle_groups (name) values
  ('Chest'), ('Back'), ('Shoulders'), ('Biceps'), ('Triceps'),
  ('Quads'), ('Hamstrings'), ('Glutes'), ('Calves'), ('Core'), ('Cardio')
on conflict (name) do nothing;

do $$
declare
  ex_id uuid;
  mg record;
  ex record;
  exercises_seed jsonb := '[
    {"name": "Barbell Bench Press", "equipment": "Barbell", "muscles": ["Chest", "Triceps", "Shoulders"]},
    {"name": "Incline Dumbbell Press", "equipment": "Dumbbell", "muscles": ["Chest", "Shoulders"]},
    {"name": "Push-Up", "equipment": "Bodyweight", "muscles": ["Chest", "Triceps"]},
    {"name": "Chest Fly", "equipment": "Machine", "muscles": ["Chest"]},
    {"name": "Deadlift", "equipment": "Barbell", "muscles": ["Back", "Hamstrings", "Glutes"]},
    {"name": "Pull-Up", "equipment": "Bodyweight", "muscles": ["Back", "Biceps"]},
    {"name": "Lat Pulldown", "equipment": "Machine", "muscles": ["Back", "Biceps"]},
    {"name": "Barbell Row", "equipment": "Barbell", "muscles": ["Back", "Biceps"]},
    {"name": "Seated Cable Row", "equipment": "Machine", "muscles": ["Back", "Biceps"]},
    {"name": "Overhead Press", "equipment": "Barbell", "muscles": ["Shoulders", "Triceps"]},
    {"name": "Lateral Raise", "equipment": "Dumbbell", "muscles": ["Shoulders"]},
    {"name": "Face Pull", "equipment": "Cable", "muscles": ["Shoulders", "Back"]},
    {"name": "Barbell Curl", "equipment": "Barbell", "muscles": ["Biceps"]},
    {"name": "Dumbbell Curl", "equipment": "Dumbbell", "muscles": ["Biceps"]},
    {"name": "Hammer Curl", "equipment": "Dumbbell", "muscles": ["Biceps"]},
    {"name": "Tricep Pushdown", "equipment": "Cable", "muscles": ["Triceps"]},
    {"name": "Skull Crusher", "equipment": "Barbell", "muscles": ["Triceps"]},
    {"name": "Dip", "equipment": "Bodyweight", "muscles": ["Triceps", "Chest"]},
    {"name": "Back Squat", "equipment": "Barbell", "muscles": ["Quads", "Glutes"]},
    {"name": "Front Squat", "equipment": "Barbell", "muscles": ["Quads", "Glutes"]},
    {"name": "Leg Press", "equipment": "Machine", "muscles": ["Quads", "Glutes"]},
    {"name": "Lunge", "equipment": "Dumbbell", "muscles": ["Quads", "Glutes"]},
    {"name": "Leg Extension", "equipment": "Machine", "muscles": ["Quads"]},
    {"name": "Romanian Deadlift", "equipment": "Barbell", "muscles": ["Hamstrings", "Glutes"]},
    {"name": "Leg Curl", "equipment": "Machine", "muscles": ["Hamstrings"]},
    {"name": "Hip Thrust", "equipment": "Barbell", "muscles": ["Glutes"]},
    {"name": "Calf Raise", "equipment": "Machine", "muscles": ["Calves"]},
    {"name": "Plank", "equipment": "Bodyweight", "muscles": ["Core"]},
    {"name": "Hanging Leg Raise", "equipment": "Bodyweight", "muscles": ["Core"]},
    {"name": "Cable Crunch", "equipment": "Cable", "muscles": ["Core"]},
    {"name": "Russian Twist", "equipment": "Bodyweight", "muscles": ["Core"]},
    {"name": "Treadmill Run", "equipment": "Machine", "muscles": ["Cardio"]},
    {"name": "Rowing Machine", "equipment": "Machine", "muscles": ["Cardio", "Back"]},
    {"name": "Cycling", "equipment": "Machine", "muscles": ["Cardio", "Quads"]}
  ]';
begin
  for ex in select * from jsonb_array_elements(exercises_seed)
  loop
    insert into exercises (user_id, name, equipment)
    values (null, ex.value->>'name', ex.value->>'equipment')
    returning id into ex_id;

    for mg in select * from jsonb_array_elements_text(ex.value->'muscles')
    loop
      insert into exercise_muscle_groups (exercise_id, muscle_group_id)
      select ex_id, id from muscle_groups where name = mg.value;
    end loop;
  end loop;
end $$;
