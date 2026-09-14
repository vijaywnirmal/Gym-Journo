import { createClient } from "@/lib/supabase/server";
import type { Exercise, MuscleGroup, WorkoutPlan, WorkoutLog } from "@/lib/types";

type ExerciseRow = {
  id: string;
  user_id: string | null;
  name: string;
  equipment: string | null;
  notes: string | null;
  exercise_muscle_groups: { muscle_group: MuscleGroup }[];
};

export async function getMuscleGroups(): Promise<MuscleGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("muscle_groups").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, user_id, name, equipment, notes, exercise_muscle_groups(muscle_group:muscle_groups(id, name))")
    .order("name");
  if (error) throw error;

  return ((data ?? []) as unknown as ExerciseRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    equipment: row.equipment,
    notes: row.notes,
    muscle_groups: row.exercise_muscle_groups.map((r) => r.muscle_group),
  }));
}

export async function getPlanForDate(date: string): Promise<WorkoutPlan | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workout_plans")
    .select(
      "*, workout_plan_muscle_groups(muscle_group:muscle_groups(id, name)), planned_exercises(*, exercise:exercises(id, name, equipment))"
    )
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as WorkoutPlan & {
    workout_plan_muscle_groups: { muscle_group: MuscleGroup }[];
  };

  return {
    ...row,
    muscle_groups: row.workout_plan_muscle_groups?.map((r) => r.muscle_group) ?? [],
    planned_exercises: (row.planned_exercises ?? []).sort((a, b) => a.position - b.position),
  };
}

export async function getWeekOverview(dates: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map<string, { title: string | null; completed: boolean }>();

  const [{ data: plans }, { data: logs }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("date, title")
      .eq("user_id", user.id)
      .in("date", dates),
    supabase
      .from("workout_logs")
      .select("date, completed_at")
      .eq("user_id", user.id)
      .in("date", dates),
  ]);

  const overview = new Map<string, { title: string | null; completed: boolean }>();
  for (const date of dates) overview.set(date, { title: null, completed: false });
  for (const plan of plans ?? []) {
    overview.set(plan.date, { ...overview.get(plan.date)!, title: plan.title });
  }
  for (const log of logs ?? []) {
    overview.set(log.date, { ...overview.get(log.date)!, completed: !!log.completed_at });
  }
  return overview;
}

export async function getLogHistory(exerciseId?: string): Promise<WorkoutLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "*, logged_exercises(*, exercise:exercises(id, name, equipment), logged_sets(*))"
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(60);

  if (error) return [];

  let logs = (data ?? []) as unknown as WorkoutLog[];
  logs = logs.map((log) => ({
    ...log,
    logged_exercises: (log.logged_exercises ?? [])
      .sort((a, b) => a.position - b.position)
      .map((le) => ({
        ...le,
        logged_sets: (le.logged_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      })),
  }));

  if (exerciseId) {
    logs = logs
      .map((log) => ({
        ...log,
        logged_exercises: log.logged_exercises?.filter((le) => le.exercise_id === exerciseId),
      }))
      .filter((log) => log.logged_exercises && log.logged_exercises.length > 0);
  }

  return logs;
}

export async function getLogForDate(date: string): Promise<WorkoutLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "*, logged_exercises(*, exercise:exercises(id, name, equipment), logged_sets(*))"
    )
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as WorkoutLog;
  return {
    ...row,
    logged_exercises: (row.logged_exercises ?? [])
      .sort((a, b) => a.position - b.position)
      .map((le) => ({
        ...le,
        logged_sets: (le.logged_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      })),
  };
}
