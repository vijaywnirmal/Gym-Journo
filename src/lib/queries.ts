import { createClient } from "@/lib/supabase/server";
import { today, shiftDate } from "@/lib/date";
import type {
  Exercise,
  MuscleGroup,
  WorkoutPlan,
  WorkoutLog,
  LoggedSet,
  Profile,
  WorkoutTemplate,
  BodyMeasurement,
} from "@/lib/types";

export type AiPlan = {
  id: string;
  activity_level: string | null;
  dietary_preference: string | null;
  notes: string | null;
  plan_markdown: string;
  created_at: string;
};

export async function getAiPlans(): Promise<AiPlan[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("ai_plans")
    .select("id, activity_level, dietary_preference, notes, plan_markdown, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function getNutritionForDate(date: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("nutrition_logs")
    .select("meals_text")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  return data?.meals_text ?? null;
}

// Compact text summary of the last N days of actual workout activity, for feeding into an AI prompt.
export async function getRecentTrainingSummary(days: number): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "No training history available.";

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("workout_logs")
    .select(
      "date, completed_at, logged_exercises(exercise:exercises(name), logged_sets(id))"
    )
    .eq("user_id", user.id)
    .gte("date", sinceStr)
    .order("date", { ascending: false });

  type Row = {
    date: string;
    completed_at: string | null;
    logged_exercises: { exercise: { name: string } | null; logged_sets: { id: string }[] }[];
  };
  const rows = (data ?? []) as unknown as Row[];

  if (rows.length === 0) return "No workouts logged in the last " + days + " days.";

  return rows
    .map((row) => {
      const exSummary = row.logged_exercises
        .map((le) => `${le.exercise?.name ?? "Exercise"} (${le.logged_sets.length} sets)`)
        .join(", ");
      return `${row.date}${row.completed_at ? "" : " (incomplete)"}: ${exSummary || "no exercises logged"}`;
    })
    .join("\n");
}

// Compact text summary of the next N days of scheduled workouts/rest days, for feeding into an AI prompt.
export async function getUpcomingScheduleSummary(days: number): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "No schedule available.";

  const todayStr = new Date().toISOString().slice(0, 10);
  const until = new Date();
  until.setDate(until.getDate() + days);
  const untilStr = until.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("workout_plans")
    .select("date, title, is_rest_day, workout_plan_muscle_groups(muscle_group:muscle_groups(name))")
    .eq("user_id", user.id)
    .gte("date", todayStr)
    .lte("date", untilStr)
    .order("date", { ascending: true });

  type Row = {
    date: string;
    title: string | null;
    is_rest_day: boolean;
    workout_plan_muscle_groups: { muscle_group: { name: string } | null }[];
  };
  const rows = (data ?? []) as unknown as Row[];

  if (rows.length === 0) return "Nothing scheduled for the next " + days + " days.";

  return rows
    .map((row) => {
      if (row.is_rest_day) return `${row.date}: Rest day${row.title ? ` (${row.title})` : ""}`;
      const muscles = row.workout_plan_muscle_groups
        .map((m) => m.muscle_group?.name)
        .filter(Boolean)
        .join(", ");
      return `${row.date}: ${row.title ?? "Workout"}${muscles ? ` — ${muscles}` : ""}`;
    })
    .join("\n");
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

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

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workout_templates")
    .select(
      "*, template_exercises(*, exercise:exercises(id, user_id, name, equipment, notes))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  return ((data ?? []) as unknown as WorkoutTemplate[]).map((template) => ({
    ...template,
    template_exercises: (template.template_exercises ?? []).sort(
      (a, b) => a.position - b.position
    ),
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
  if (!user)
    return new Map<
      string,
      { title: string | null; completed: boolean; isRestDay: boolean }
    >();

  const [{ data: plans }, { data: logs }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("date, title, is_rest_day")
      .eq("user_id", user.id)
      .in("date", dates),
    supabase
      .from("workout_logs")
      .select("date, completed_at")
      .eq("user_id", user.id)
      .in("date", dates),
  ]);

  const overview = new Map<
    string,
    { title: string | null; completed: boolean; isRestDay: boolean }
  >();
  for (const date of dates) overview.set(date, { title: null, completed: false, isRestDay: false });
  for (const plan of plans ?? []) {
    overview.set(plan.date, {
      ...overview.get(plan.date)!,
      title: plan.title,
      isRestDay: plan.is_rest_day,
    });
  }
  for (const log of logs ?? []) {
    overview.set(log.date, { ...overview.get(log.date)!, completed: !!log.completed_at });
  }
  return overview;
}

// A workout_log with its plan's title attached (via the log's own plan_id — not a live lookup
// by date), for identifying/labelling a day without pulling in target_sets/target_reps.
export type WorkoutLogWithContext = WorkoutLog & { planTitle: string | null };

const DEFAULT_HISTORY_PAGE_SIZE = 30;

export type LogHistoryPage = {
  logs: WorkoutLogWithContext[];
  hasMore: boolean;
};

// Server-rendered, cursor-paginated history — same searchParam-driven pattern as Calendar's
// week paging, so no client-side accumulation/infinite-scroll infrastructure is needed. `before`
// is an exclusive date cursor (workout_logs has at most one row per user per date, so date is a
// safe, stable cursor). The exercise filter is applied at the query level (not post-fetch), so a
// page's row count and the "is there another page" check stay accurate even when filtered.
export async function getLogHistory(options: {
  exerciseId?: string;
  before?: string;
  pageSize?: number;
} = {}): Promise<LogHistoryPage> {
  const { exerciseId, before, pageSize = DEFAULT_HISTORY_PAGE_SIZE } = options;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { logs: [], hasMore: false };

  const loggedExercisesEmbed = exerciseId ? "logged_exercises!inner" : "logged_exercises";

  let query = supabase
    .from("workout_logs")
    .select(
      `*, plan:workout_plans(title), ${loggedExercisesEmbed}(*, exercise:exercises(id, name, equipment), logged_sets(*))`
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    // Fetch one extra row past the page size to know whether another page exists, without a
    // separate count query.
    .limit(pageSize + 1);

  if (exerciseId) query = query.eq("logged_exercises.exercise_id", exerciseId);
  if (before) query = query.lt("date", before);

  const { data, error } = await query;
  if (error) return { logs: [], hasMore: false };

  type Row = WorkoutLog & { plan: { title: string | null } | null };
  const rows = (data ?? []) as unknown as Row[];
  const hasMore = rows.length > pageSize;

  const logs = rows.slice(0, pageSize).map((row) => ({
    ...row,
    planTitle: row.plan?.title ?? null,
    logged_exercises: (row.logged_exercises ?? [])
      .sort((a, b) => a.position - b.position)
      .map((le) => ({
        ...le,
        logged_sets: (le.logged_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      })),
  }));

  return { logs, hasMore };
}

export type LastCompletedLog = {
  date: string;
  title: string | null;
};

// Narrow, Home-specific lookup — avoids pulling the full nested history just to find one row.
export async function getLastCompletedLog(): Promise<LastCompletedLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, plan:workout_plans(title)")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as { date: string; plan: { title: string | null } | null };
  return { date: row.date, title: row.plan?.title ?? null };
}

export type PreviousPerformance = {
  date: string;
  sets: { reps: number | null; weight: number | null; weightUnit: string }[];
};

// The most recent previously-logged sets for one exercise, strictly before `beforeDate` — "what
// did I do last time?" context for the logger. Not filtered by completed_at: History already
// treats incomplete logs as real logged data, so this matches that existing semantics.
export async function getPreviousPerformance(
  exerciseId: string,
  beforeDate: string
): Promise<PreviousPerformance | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, logged_exercises!inner(exercise_id, logged_sets(*))")
    .eq("user_id", user.id)
    .eq("logged_exercises.exercise_id", exerciseId)
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  type Row = {
    date: string;
    logged_exercises: { logged_sets: LoggedSet[] }[];
  };
  const row = data as unknown as Row;
  const sets = (row.logged_exercises[0]?.logged_sets ?? []).sort(
    (a, b) => a.set_number - b.set_number
  );
  if (sets.length === 0) return null;

  return {
    date: row.date,
    sets: sets.map((s) => ({ reps: s.reps, weight: s.weight, weightUnit: s.weight_unit })),
  };
}

export type TrainingConsistency = {
  windowDays: number;
  daysLogged: number;
};

// Count of distinct days with a workout_logs row in the rolling window ending today — a purely
// descriptive activity count. Every day counts equally regardless of planned/freeform,
// completed_at, or how many exercises/sets it has; workout_logs.date is already unique per user
// (see 0001_init.sql), so no separate de-duplication step is needed.
export async function getTrainingConsistency(windowDays = 28): Promise<TrainingConsistency> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { windowDays, daysLogged: 0 };

  const sinceStr = shiftDate(today(), -windowDays);
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", sinceStr);

  if (error) return { windowDays, daysLogged: 0 };
  return { windowDays, daysLogged: data?.length ?? 0 };
}

export type BodyWeightWindowPoint = { date: string; weightKg: number };

export type BodyWeightWindow = {
  windowDays: number;
  measurementCount: number;
  earliest: BodyWeightWindowPoint | null;
  latest: BodyWeightWindowPoint | null;
};

// The earliest and latest body_measurements rows within the rolling window ending today, for a
// simple raw-delta comparison — no interpolation, no rate, no percentage. When only one
// measurement falls in the window, earliest and latest are the same row (the caller decides
// not to show a delta when measurementCount < 2).
export async function getBodyWeightWindow(windowDays = 28): Promise<BodyWeightWindow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { windowDays, measurementCount: 0, earliest: null, latest: null };

  const sinceStr = shiftDate(today(), -windowDays);
  const { data, error } = await supabase
    .from("body_measurements")
    .select("date, weight_kg")
    .eq("user_id", user.id)
    .gte("date", sinceStr)
    .order("date", { ascending: true });

  if (error || !data || data.length === 0) {
    return { windowDays, measurementCount: 0, earliest: null, latest: null };
  }

  const earliest = data[0];
  const latest = data[data.length - 1];
  return {
    windowDays,
    measurementCount: data.length,
    earliest: { date: earliest.date, weightKg: earliest.weight_kg },
    latest: { date: latest.date, weightKg: latest.weight_kg },
  };
}

// All of a user's historical weight entries, newest first. Small, unpaginated data volume (at
// most one row per day) — no cap/pagination is warranted here, unlike workout history.
export async function getBodyMeasurements(): Promise<BodyMeasurement[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function getLogForDate(date: string): Promise<WorkoutLogWithContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "*, plan:workout_plans(title), logged_exercises(*, exercise:exercises(id, name, equipment), logged_sets(*))"
    )
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as WorkoutLog & { plan: { title: string | null } | null };
  return {
    ...row,
    planTitle: row.plan?.title ?? null,
    logged_exercises: (row.logged_exercises ?? [])
      .sort((a, b) => a.position - b.position)
      .map((le) => ({
        ...le,
        logged_sets: (le.logged_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      })),
  };
}
