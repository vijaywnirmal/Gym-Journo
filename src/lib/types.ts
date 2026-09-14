export type MuscleGroup = {
  id: string;
  name: string;
};

export type Exercise = {
  id: string;
  user_id: string | null;
  name: string;
  equipment: string | null;
  notes: string | null;
  muscle_groups?: MuscleGroup[];
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  muscle_groups?: MuscleGroup[];
  planned_exercises?: PlannedExercise[];
};

export type PlannedExercise = {
  id: string;
  plan_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  exercise?: Exercise;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  plan_id: string | null;
  date: string;
  notes: string | null;
  completed_at: string | null;
  logged_exercises?: LoggedExercise[];
};

export type LoggedExercise = {
  id: string;
  log_id: string;
  exercise_id: string;
  position: number;
  exercise?: Exercise;
  logged_sets?: LoggedSet[];
};

export type LoggedSet = {
  id: string;
  logged_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  weight_unit: string;
  notes: string | null;
};
