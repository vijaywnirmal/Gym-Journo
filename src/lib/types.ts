export type MuscleGroup = {
  id: string;
  name: string;
};

export type Profile = {
  id: string;
  created_at?: string;
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
  // Workout reminders over web push (migration 0030). reminder_time is local, "HH:MM:SS".
  workout_reminders?: boolean;
  reminder_time?: string;
  onboarded: boolean;
};

export type Exercise = {
  id: string;
  user_id: string | null;
  name: string;
  equipment: string | null;
  notes: string | null;
  instructions?: string | null;
  demo_images?: string[] | null;
  muscle_groups?: MuscleGroup[];
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  is_rest_day: boolean;
  // 'rest' | 'absence' on a day off (migration 0029); see lib/dayType.ts.
  off_kind?: string | null;
  // The day off was marked after its date had passed (set by the database).
  off_marked_late?: boolean;
  // Who made and who last changed the plan (migration 0034; null before it). See lib/planAuthors.ts.
  created_by?: string | null;
  updated_by?: string | null;
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
  notes?: string | null;
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
  set_type?: string;
  rpe?: number | null;
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

// Trainers (migration 0034). Having a trainer_profiles row is what makes an account a trainer.
export type TrainerProfile = {
  user_id: string;
  display_name: string;
  gym_name: string | null;
  city: string | null;
  // Digits with a leading +, e.g. +919876543210.
  whatsapp: string | null;
  created_at: string;
};

export type TrainerInvite = {
  code: string;
  expires_at: string;
};

// The signed-in client's current trainer, as their Profile shows it.
export type MyTrainer = {
  linkId: string;
  trainerId: string;
  startedAt: string;
  trainer: Pick<TrainerProfile, "display_name" | "gym_name" | "city" | "whatsapp">;
};

// One row of the trainer's dashboard (trainer_client_overview). "Today" and "this week" (Monday to
// Sunday) are the client's, in their time zone.
export type ClientOverview = {
  link_id: string;
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  primary_goal: string | null;
  experience_level: string | null;
  training_days_per_week: number | null;
  started_at: string;
  client_today: string;
  today_plan: "workout" | "rest" | "absence" | null;
  today_done: boolean;
  planned_this_week: number;
  done_this_week: number;
  last_workout_on: string | null;
  latest_weight_kg: number | null;
  latest_weight_on: string | null;
};

// A client's plan as client_plans returns it.
export type ClientPlan = {
  id: string;
  date: string;
  title: string | null;
  is_rest_day: boolean;
  off_kind: string | null;
  off_marked_late: boolean;
  created_by: string | null;
  updated_by: string | null;
  muscle_group_ids: string[];
  exercises: {
    id: string;
    exercise_id: string;
    name: string;
    equipment: string | null;
    position: number;
    target_sets: number | null;
    target_reps: number | null;
    target_weight: number | null;
    target_weight_unit: string;
  }[];
};

// A client's logged workout as client_logs returns it.
export type ClientLog = {
  id: string;
  date: string;
  plan_id: string | null;
  notes: string | null;
  completed_at: string | null;
  exercises: {
    exercise_id: string;
    name: string;
    position: number;
    notes: string | null;
    sets: {
      set_number: number;
      reps: number | null;
      weight: number | null;
      weight_unit: string;
      set_type: string | null;
      rpe: number | null;
      notes: string | null;
    }[];
  }[];
};

// Gyms (migration 0037).
export type Gym = {
  id: string;
  owner_id: string;
  name: string;
  city: string | null;
  area: string | null;
  phone: string | null;
  created_at: string;
};

export type GymRole = "admin" | "trainer" | "member";

// One row of a gym's members list (gym_member_overview): counts and dates only. offered_* is a
// trainer the gym suggested that the member hasn't answered yet; declined_* one they said no to
// (0038), while they have no trainer and nothing new is suggested.
export type GymMemberRow = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  joined_at: string;
  trainer_id: string | null;
  trainer_name: string | null;
  offered_trainer_id: string | null;
  offered_trainer_name: string | null;
  declined_trainer_id: string | null;
  declined_trainer_name: string | null;
  has_own_trainer: boolean;
  workouts_this_week: number;
  days_since_last_workout: number | null;
};

// A trainer the member's gym suggested (my_gym_trainer_offer). trainer_runs_gym: they're also the
// gym's owner or an admin.
export type GymTrainerOffer = {
  offer_id: string;
  gym_name: string;
  trainer_id: string;
  trainer_name: string;
  trainer_runs_gym: boolean;
};

export type GymTrainerRow = {
  trainer_id: string;
  display_name: string;
  joined_at: string;
  members_assigned: number;
  plans_this_week: number;
  members_inactive_7_days: number;
};
