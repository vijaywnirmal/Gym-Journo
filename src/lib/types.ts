export type MuscleGroup = {
  id: string;
  name: string;
};

export type Profile = {
  id: string;
  // full_name is the joined display name; first_name / last_name are what the person edits.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  primary_goal: string | null;
  target_weight_kg: number | null;
  experience_level: string | null;
  training_days_per_week: number | null;
  // When the person opted in to sending training evidence to Coach's external model; null = no consent.
  coach_consent_at: string | null;
  // IANA timezone from the person's device; defines their "today". Null = not known yet.
  timezone: string | null;
  onboarded: boolean;
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
  is_rest_day: boolean;
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
  target_weight: number | null;
  target_weight_unit: string;
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

// A reusable workout definition. Instantiating one copies its template_exercises into a dated
// WorkoutPlan/PlannedExercise row set — there is no live link back to the template afterward.
export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  template_exercises?: TemplateExercise[];
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_weight_unit: string;
  exercise?: Exercise;
};

// A historical body-weight entry — separate from and never synced with profiles.weight_kg
// (the current-attribute field). One row per user per date.
export type BodyMeasurement = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
