import { createClient } from "@/lib/supabase/server";
import { shiftDate, weekDates } from "@/lib/date";
import { suggestOverload, type OverloadSuggestion } from "@/lib/analyze/overload";
import {
  countMuscleSets,
  planAdherence,
  type MuscleSets,
  type MuscleSetsLog,
  type PlanAdherence,
} from "@/lib/analyze/weeklyInsights";
import { getToday } from "@/lib/userDate";
import {
  isWorkoutDay,
  performedWorkoutDates,
  windowStart,
  type WorkoutLogLike,
} from "@/lib/analyze/definitions";
import {
  buildWeeklyTrainingDays,
  COMPLETED_WEEKS,
  oldestWeekStart,
  type WeeklyTrainingDays,
} from "@/lib/analyze/weeklyTraining";
import {
  buildTrainingEvidence,
  MAX_EVIDENCE_EXERCISES,
  RECENT_EXERCISE_WINDOW_DAYS,
  type TrainingEvidence,
} from "@/lib/analyze/evidence";
import {
  buildExerciseSessions,
  performedSetsOf,
  recentPerformedExerciseIds,
  type ExerciseSession,
  type PerformedSet,
  type SessionSourceLog,
} from "@/lib/analyze/exerciseSessions";
import type {
  Exercise,
  MuscleGroup,
  WorkoutPlan,
  WorkoutLog,
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

  const sinceStr = shiftDate(await getToday(), -days);

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

  const todayStr = await getToday();
  const untilStr = shiftDate(todayStr, days);

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
  instructions?: string | null;
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
    .select(
      "id, user_id, name, equipment, notes, instructions, exercise_muscle_groups(muscle_group:muscle_groups(id, name))"
    )
    .order("name");
  if (error) throw error;

  return ((data ?? []) as unknown as ExerciseRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    equipment: row.equipment,
    notes: row.notes,
    instructions: row.instructions ?? null,
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

// Per-day Calendar state. `performed` (a canonical workout day — see analyze/definitions.ts) and
// `completed` (the user explicitly marked the workout complete) are separate facts: a day can be
// either, both, or neither, and neither is derived from the other.
export type WeekDayOverview = {
  title: string | null;
  performed: boolean;
  completed: boolean;
  isRestDay: boolean;
};

export async function getWeekOverview(dates: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map<string, WeekDayOverview>();

  const [{ data: plans }, { data: logs }] = await Promise.all([
    supabase
      .from("workout_plans")
      .select("date, title, is_rest_day")
      .eq("user_id", user.id)
      .in("date", dates),
    supabase
      .from("workout_logs")
      .select("date, completed_at, logged_exercises(logged_sets(reps, weight))")
      .eq("user_id", user.id)
      .in("date", dates),
  ]);

  const overview = new Map<string, WeekDayOverview>();
  for (const date of dates) {
    overview.set(date, { title: null, performed: false, completed: false, isRestDay: false });
  }
  for (const plan of plans ?? []) {
    overview.set(plan.date, {
      ...overview.get(plan.date)!,
      title: plan.title,
      isRestDay: plan.is_rest_day,
    });
  }
  const todayStr = await getToday();
  for (const log of (logs ?? []) as unknown as (WorkoutLogLike & {
    completed_at: string | null;
  })[]) {
    overview.set(log.date, {
      ...overview.get(log.date)!,
      performed: isWorkoutDay(log, todayStr),
      completed: !!log.completed_at,
    });
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
// safe, stable cursor). This is the raw, unfiltered log list; exercise-specific History is built
// from performed sessions instead (getExerciseSessions).
export async function getLogHistory(options: {
  before?: string;
  pageSize?: number;
} = {}): Promise<LogHistoryPage> {
  const { before, pageSize = DEFAULT_HISTORY_PAGE_SIZE } = options;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { logs: [], hasMore: false };

  let query = supabase
    .from("workout_logs")
    .select(
      "*, plan:workout_plans(title), logged_exercises(*, exercise:exercises(id, name, equipment), logged_sets(*))"
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    // Fetch one extra row past the page size to know whether another page exists, without a
    // separate count query.
    .limit(pageSize + 1);

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

// Every performed session of one exercise, newest first — the full history, never a History page
// (no before-cursor, no limit), so first/last/count facts cannot depend on pagination. A session
// is a log on or before today where the exercise has at least one performed set; blank placeholder
// sets, planned-but-skipped exercises and future dates are excluded (see analyze/definitions.ts),
// and duplicate occurrences on one log collapse to one session. Incomplete logs still count
// (completed_at is a separate concept). Only performed sets are returned, each with its own
// set_number. A single request is subject to the API's max-rows cap (commonly 1,000 logs).
export async function getExerciseSessions(exerciseId: string): Promise<ExerciseSession[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const todayStr = await getToday();
  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "date, logged_exercises!inner(exercise_id, position, logged_sets(set_number, reps, weight, weight_unit, set_type))"
    )
    .eq("user_id", user.id)
    .eq("logged_exercises.exercise_id", exerciseId)
    .lte("date", todayStr)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return buildExerciseSessions(data as unknown as SessionSourceLog[], exerciseId, todayStr);
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
    // A future-dated log can never be the "last" completed workout. Bounded by date only —
    // completed_at is still the sole completion signal and nothing else about it is redefined.
    .lte("date", await getToday())
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as { date: string; plan: { title: string | null } | null };
  return { date: row.date, title: row.plan?.title ?? null };
}

export type PreviousPerformance = {
  date: string;
  sets: PerformedSet[];
};

const PREVIOUS_PERFORMANCE_PAGE_SIZE = 20;

// The most recent previously-performed session for one exercise, strictly before `beforeDate` —
// "what did I do last time?" context for the logger. A session where the exercise only holds
// blank placeholder sets is skipped in favour of the earlier real one, and only performed sets
// are returned (each keeps its own set_number, so same-set-number comparison is unaffected). Not
// filtered by completed_at: History already treats incomplete logs as real logged data.
export async function getPreviousPerformance(
  exerciseId: string,
  beforeDate: string
): Promise<PreviousPerformance | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Walks back through matching logs a page at a time until one contains performed sets — blank
  // sessions are rare, so this is normally a single query.
  let cursor = beforeDate;
  for (;;) {
    const { data, error } = await supabase
      .from("workout_logs")
      .select("date, logged_exercises!inner(exercise_id, logged_sets(*))")
      .eq("user_id", user.id)
      .eq("logged_exercises.exercise_id", exerciseId)
      .lt("date", cursor)
      .order("date", { ascending: false })
      .limit(PREVIOUS_PERFORMANCE_PAGE_SIZE);

    if (error || !data) return null;
    const rows = data as unknown as SessionSourceLog[];

    for (const row of rows) {
      const sets = performedSetsOf(row, exerciseId);
      if (sets.length === 0) continue;
      return { date: row.date, sets };
    }

    if (rows.length < PREVIOUS_PERFORMANCE_PAGE_SIZE) return null;
    cursor = rows[rows.length - 1].date;
  }
}

export type TrainingConsistency = {
  windowDays: number;
  daysPerformed: number;
};

// Count of distinct workout days (see analyze/definitions.ts: a performed, non-future log) in the
// inclusive N-calendar-day window ending today. A log row that exists but holds no performed set
// — empty, or only blank planned sets — is not a workout day. completed_at and planned/freeform
// are irrelevant. workout_logs.date is already unique per user (0001_init.sql); the Set keeps the
// result a count of dates regardless.
export async function getTrainingConsistency(windowDays = 28): Promise<TrainingConsistency> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { windowDays, daysPerformed: 0 };

  const todayStr = await getToday();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, logged_exercises(logged_sets(reps, weight))")
    .eq("user_id", user.id)
    .gte("date", windowStart(windowDays, todayStr))
    .lte("date", todayStr);

  if (error) return { windowDays, daysPerformed: 0 };

  const performedDates = performedWorkoutDates((data ?? []) as unknown as WorkoutLogLike[], todayStr);
  return { windowDays, daysPerformed: performedDates.size };
}

// The distinct workout dates (canonical definition: performed, not in the future) from `sinceDate`
// through today, ascending. Null when signed out or on a query error, so callers can tell "no
// workouts" from "couldn't read".
export async function getPerformedWorkoutDates(sinceDate: string): Promise<string[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStr = await getToday();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, logged_exercises(logged_sets(reps, weight))")
    .eq("user_id", user.id)
    .gte("date", sinceDate)
    .lte("date", todayStr);

  if (error) return null;

  return [...performedWorkoutDates((data ?? []) as unknown as WorkoutLogLike[], todayStr)].sort();
}

// Workout days per Sunday–Saturday calendar week for the current (in-progress) week and the most
// recent completed weeks, newest first — see analyze/weeklyTraining.ts. Same canonical workout-day
// definition as getTrainingConsistency; empty when signed out or on a query error.
export async function getWeeklyTrainingDays(
  completedWeeks = COMPLETED_WEEKS
): Promise<WeeklyTrainingDays[]> {
  const todayStr = await getToday();
  const dates = await getPerformedWorkoutDates(oldestWeekStart(todayStr, completedWeeks));
  if (dates === null) return [];
  return buildWeeklyTrainingDays(new Set(dates), todayStr, completedWeeks);
}

export type LastPerformedWorkout = { date: string | null };

const LAST_WORKOUT_PAGE_SIZE = 30;

// The most recent workout day — a performed, non-future log — for a purely factual "when did you
// last work out" observation. Not "last completed workout" (that is getLastCompletedLog, which
// keys off completed_at): a performed but never-completed session counts here. Walks back a page
// at a time past any blank/empty logs.
export async function getLastPerformedWorkoutDate(): Promise<LastPerformedWorkout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { date: null };

  const todayStr = await getToday();
  let before: string | null = null;
  for (;;) {
    let query = supabase
      .from("workout_logs")
      .select("date, logged_exercises(logged_sets(reps, weight))")
      .eq("user_id", user.id)
      .lte("date", todayStr)
      .order("date", { ascending: false })
      .limit(LAST_WORKOUT_PAGE_SIZE);
    if (before) query = query.lt("date", before);

    const { data, error } = await query;
    if (error || !data) return { date: null };
    const rows = data as unknown as WorkoutLogLike[];

    const latest = rows.find((row) => isWorkoutDay(row, todayStr));
    if (latest) return { date: latest.date };

    if (rows.length < LAST_WORKOUT_PAGE_SIZE) return { date: null };
    before = rows[rows.length - 1].date;
  }
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

// Assembles the evidence bundle a future Coach layer would read (analyze/evidence.ts): goal
// settings, recent and weekly training, dated body weight, and the recent history of the
// exercises performed in the last few weeks. Fetching only — every figure is computed by the pure
// Analyze functions from canonical-definition data. Null when signed out or when the workout
// history itself can't be read (other sources degrade to "nothing recorded", as elsewhere).
export async function getTrainingEvidence(): Promise<TrainingEvidence | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStr = await getToday();
  const [profile, performedDates, lastPerformed, measurements, exercises, recentLogs] =
    await Promise.all([
      getProfile(),
      getPerformedWorkoutDates(oldestWeekStart(todayStr)),
      getLastPerformedWorkoutDate(),
      getBodyMeasurements(),
      getExercises(),
      supabase
        .from("workout_logs")
        .select("date, logged_exercises(exercise_id, logged_sets(reps, weight))")
        .eq("user_id", user.id)
        .gte("date", windowStart(RECENT_EXERCISE_WINDOW_DAYS, todayStr))
        .lte("date", todayStr),
    ]);

  if (performedDates === null || recentLogs.error) return null;

  const recentIds = recentPerformedExerciseIds(
    (recentLogs.data ?? []) as unknown as Parameters<typeof recentPerformedExerciseIds>[0],
    todayStr
  );
  const chosenIds = recentIds.slice(0, MAX_EVIDENCE_EXERCISES);
  const namesById = new Map(exercises.map((ex) => [ex.id, ex.name]));
  const sessions = await Promise.all(chosenIds.map((id) => getExerciseSessions(id)));

  return buildTrainingEvidence({
    todayStr,
    profile,
    performedDates,
    lastPerformedWorkoutDate: lastPerformed.date,
    bodyMeasurements: measurements,
    exercises: chosenIds.map((exerciseId, i) => ({
      exerciseId,
      name: namesById.get(exerciseId) ?? "Exercise",
      sessions: sessions[i],
    })),
    exercisesTruncated: recentIds.length > chosenIds.length,
  });
}

// Every performed session strictly before `beforeDate` for each of the given exercises, newest
// first — the history a personal record has to beat. One request for all exercises; subject to the
// same max-rows cap as getExerciseSessions. Exercises with no earlier session map to [].
export async function getPriorExerciseSessions(
  exerciseIds: string[],
  beforeDate: string
): Promise<Record<string, ExerciseSession[]> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return {};

  const todayStr = await getToday();
  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "date, logged_exercises!inner(exercise_id, position, logged_sets(set_number, reps, weight, weight_unit, set_type))"
    )
    .eq("user_id", user.id)
    .in("logged_exercises.exercise_id", ids)
    .lt("date", beforeDate)
    .order("date", { ascending: false });

  if (error || !data) return null;

  const logs = data as unknown as SessionSourceLog[];
  return Object.fromEntries(ids.map((id) => [id, buildExerciseSessions(logs, id, todayStr)]));
}

export type WeeklyInsights = {
  thisWeek: MuscleSets[];
  lastWeek: MuscleSets[];
  // Current week first; the streak is computed against the person's goal (weeklyStreak).
  weeks: WeeklyTrainingDays[];
  adherence: PlanAdherence | null;
  adherenceWindowDays: number;
};

export const ADHERENCE_WINDOW_DAYS = 28;

type MuscleSetsRow = {
  date: string;
  logged_exercises:
    | {
        exercise: { exercise_muscle_groups: { muscle_group: { id: string; name: string } | null }[] } | null;
        logged_sets: { reps: number | null; weight: number | null; set_type?: string | null }[] | null;
      }[]
    | null;
};

// Everything the Today screen's "This week" card shows — see analyze/weeklyInsights.ts. Weeks are
// Sunday–Saturday, like Calendar. Null when signed out or when the workout history can't be read.
export async function getWeeklyInsights(): Promise<WeeklyInsights | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStr = await getToday();
  const thisWeekStart = weekDates(todayStr)[0];
  const lastWeekStart = shiftDate(thisWeekStart, -7);
  const adherenceStart = shiftDate(todayStr, -(ADHERENCE_WINDOW_DAYS - 1));

  const [logsResult, plansResult, weeks, performedDates] = await Promise.all([
    supabase
      .from("workout_logs")
      .select(
        "date, logged_exercises(exercise:exercises(exercise_muscle_groups(muscle_group:muscle_groups(id, name))), logged_sets(reps, weight, set_type))"
      )
      .eq("user_id", user.id)
      .gte("date", lastWeekStart)
      .lte("date", todayStr),
    supabase
      .from("workout_plans")
      .select("date")
      .eq("user_id", user.id)
      .eq("is_rest_day", false)
      .gte("date", adherenceStart)
      .lte("date", todayStr),
    getWeeklyTrainingDays(),
    getPerformedWorkoutDates(adherenceStart),
  ]);

  if (logsResult.error || !logsResult.data || performedDates === null) return null;

  const logs: MuscleSetsLog[] = (logsResult.data as unknown as MuscleSetsRow[]).map((row) => ({
    date: row.date,
    logged_exercises: (row.logged_exercises ?? []).map((le) => ({
      muscle_groups: (le.exercise?.exercise_muscle_groups ?? [])
        .map((emg) => emg.muscle_group)
        .filter((mg): mg is { id: string; name: string } => mg !== null),
      logged_sets: le.logged_sets,
    })),
  }));

  return {
    thisWeek: countMuscleSets(logs, thisWeekStart, todayStr),
    lastWeek: countMuscleSets(logs, lastWeekStart, shiftDate(thisWeekStart, -1)),
    weeks,
    adherence: plansResult.error
      ? null
      : planAdherence(
          (plansResult.data ?? []).map((p) => p.date as string),
          new Set(performedDates),
          todayStr
        ),
    adherenceWindowDays: ADHERENCE_WINDOW_DAYS,
  };
}

export const ADAPT_HORIZON_DAYS = 14;

export type AdaptSuggestion = {
  plannedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  planDate: string;
  planTitle: string | null;
  suggestion: OverloadSuggestion;
};

type UpcomingPlanRow = {
  date: string;
  title: string | null;
  planned_exercises:
    | {
        id: string;
        exercise_id: string;
        position: number;
        target_sets: number | null;
        target_reps: number | null;
        target_weight: number | null;
        target_weight_unit: string | null;
        exercise: { name: string } | null;
      }[]
    | null;
};

// Progressive-overload suggestions for the next planned occurrence of each exercise in the coming
// two weeks (see analyze/overload.ts), each based only on sessions logged before that plan's date.
// Planned exercises the person already decided on are left out. [] when signed out or on error.
export async function getAdaptSuggestions(): Promise<AdaptSuggestion[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const todayStr = await getToday();
  const { data, error } = await supabase
    .from("workout_plans")
    .select(
      "date, title, planned_exercises(id, exercise_id, position, target_sets, target_reps, target_weight, target_weight_unit, exercise:exercises(name))"
    )
    .eq("user_id", user.id)
    .eq("is_rest_day", false)
    .gte("date", todayStr)
    .lte("date", shiftDate(todayStr, ADAPT_HORIZON_DAYS - 1))
    .order("date", { ascending: true });
  if (error || !data) return [];

  // The next occurrence of each exercise only — one suggestion per exercise, not one per future day.
  const next = new Map<string, { plan: UpcomingPlanRow; pe: NonNullable<UpcomingPlanRow["planned_exercises"]>[number] }>();
  for (const plan of data as unknown as UpcomingPlanRow[]) {
    const ordered = [...(plan.planned_exercises ?? [])].sort((a, b) => a.position - b.position);
    for (const pe of ordered) if (!next.has(pe.exercise_id)) next.set(pe.exercise_id, { plan, pe });
  }
  if (next.size === 0) return [];

  const plannedIds = [...next.values()].map((n) => n.pe.id);
  const { data: decided, error: decidedError } = await supabase
    .from("recommendations")
    .select("planned_exercise_id")
    .eq("user_id", user.id)
    .in("planned_exercise_id", plannedIds);
  if (decidedError) return [];
  const decidedIds = new Set((decided ?? []).map((r) => r.planned_exercise_id as string));

  const lastDate = [...next.values()].reduce((max, n) => (n.plan.date > max ? n.plan.date : max), todayStr);
  // Sessions before the latest plan date; each plan then keeps only those before its own date.
  const history = await getPriorExerciseSessions([...next.keys()], lastDate);
  if (!history) return [];

  const suggestions: AdaptSuggestion[] = [];
  for (const [exerciseId, { plan, pe }] of next) {
    if (decidedIds.has(pe.id)) continue;
    const before = (history[exerciseId] ?? []).filter((s) => s.date < plan.date);
    const suggestion = suggestOverload(
      {
        targetSets: pe.target_sets,
        targetReps: pe.target_reps,
        targetWeight: pe.target_weight === null ? null : Number(pe.target_weight),
        targetWeightUnit: pe.target_weight_unit ?? "kg",
      },
      before
    );
    if (!suggestion) continue;
    suggestions.push({
      plannedExerciseId: pe.id,
      exerciseId,
      exerciseName: pe.exercise?.name ?? "Exercise",
      planDate: plan.date,
      planTitle: plan.title,
      suggestion,
    });
  }
  return suggestions.sort((a, b) => (a.planDate < b.planDate ? -1 : a.planDate > b.planDate ? 1 : 0));
}
