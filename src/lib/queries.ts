import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/date";
import {
  isPerformedExerciseSession,
  isPerformedSet,
  isWorkoutDay,
  windowStart,
  type ExerciseSessionLike,
  type WorkoutLogLike,
} from "@/lib/analyze/definitions";
import {
  summarizeExerciseRecurrence,
  type ExerciseRecurrence,
} from "@/app/history/exerciseRecurrence";
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

export type { ExerciseRecurrence };

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
  const todayStr = today();
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
    // The `!inner` join above only decides which days (parent rows) are included when
    // exerciseId is set — Supabase still embeds every sibling logged_exercise for those days.
    // Drop siblings here so a caller filtering by exercise gets only that exercise's data, never
    // co-logged exercises from the same day.
    logged_exercises: (row.logged_exercises ?? [])
      .filter((le) => !exerciseId || le.exercise_id === exerciseId)
      .sort((a, b) => a.position - b.position)
      .map((le) => ({
        ...le,
        logged_sets: (le.logged_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      })),
  }));

  return { logs, hasMore };
}

// Full-history recurrence for one exercise — every performed session date, not a History page.
// A session counts only when the selected exercise has at least one performed set on that log
// (blank placeholder sets and planned-but-skipped exercises don't), and only for dates on or
// before today. Incomplete logs still count (completed_at is a separate concept). Duplicate rows
// for the same exercise on one log collapse via summarizeExerciseRecurrence. No before-cursor,
// no limit.
export async function getExerciseRecurrence(
  exerciseId: string
): Promise<ExerciseRecurrence | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStr = today();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, logged_exercises!inner(exercise_id, logged_sets(reps, weight))")
    .eq("user_id", user.id)
    .eq("logged_exercises.exercise_id", exerciseId)
    .lte("date", todayStr);

  if (error || !data) return null;

  const dates = (data as unknown as ExerciseSessionLike[])
    .filter((row) => isPerformedExerciseSession(row, exerciseId, todayStr))
    .map((row) => row.date);

  return summarizeExerciseRecurrence(dates);
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
    .lte("date", today())
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as { date: string; plan: { title: string | null } | null };
  return { date: row.date, title: row.plan?.title ?? null };
}

export type PreviousPerformance = {
  date: string;
  sets: { setNumber: number; reps: number | null; weight: number | null; weightUnit: string }[];
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

  type Row = {
    date: string;
    logged_exercises: { exercise_id: string; logged_sets: LoggedSet[] | null }[];
  };

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
    const rows = data as unknown as Row[];

    for (const row of rows) {
      const sets = row.logged_exercises
        .filter((le) => le.exercise_id === exerciseId)
        .flatMap((le) => le.logged_sets ?? [])
        .filter(isPerformedSet)
        .sort((a, b) => a.set_number - b.set_number);
      if (sets.length === 0) continue;

      return {
        date: row.date,
        sets: sets.map((s) => ({
          setNumber: s.set_number,
          reps: s.reps,
          weight: s.weight,
          weightUnit: s.weight_unit,
        })),
      };
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

  const todayStr = today();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, logged_exercises(logged_sets(reps, weight))")
    .eq("user_id", user.id)
    .gte("date", windowStart(windowDays, todayStr))
    .lte("date", todayStr);

  if (error) return { windowDays, daysPerformed: 0 };

  const performedDates = new Set(
    ((data ?? []) as unknown as WorkoutLogLike[])
      .filter((row) => isWorkoutDay(row, todayStr))
      .map((row) => row.date)
  );
  return { windowDays, daysPerformed: performedDates.size };
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

  const todayStr = today();
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

export type BodyWeightWindowPoint = { date: string; weightKg: number };

export type BodyWeightWindow = {
  windowDays: number;
  measurementCount: number;
  earliest: BodyWeightWindowPoint | null;
  latest: BodyWeightWindowPoint | null;
};

// The earliest and latest body_measurements rows within the inclusive N-day window ending today, for a
// simple raw-delta comparison — no interpolation, no rate, no percentage. When only one
// measurement falls in the window, earliest and latest are the same row (the caller decides
// not to show a delta when measurementCount < 2).
export async function getBodyWeightWindow(windowDays = 28): Promise<BodyWeightWindow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { windowDays, measurementCount: 0, earliest: null, latest: null };

  const { data, error } = await supabase
    .from("body_measurements")
    .select("date, weight_kg")
    .eq("user_id", user.id)
    .gte("date", windowStart(windowDays))
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
