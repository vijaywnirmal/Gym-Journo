import { shiftDate, today } from "@/lib/date";

// Canonical Analyze definitions (Release 2, S1). Every analytical count/date in the app derives
// from these, so "a workout", "a set", and "last N days" mean one thing everywhere.
//
// Terminology — deliberately distinct, never interchangeable:
//   LOGGED     a workout_logs row exists (says nothing about its contents)
//   PERFORMED  the log contains at least one non-blank set
//   COMPLETED  the user explicitly marked the workout complete (completed_at) — a separate flag,
//              never used here to decide whether anything was performed
//   WORKOUT DAY  a date whose log is PERFORMED and is not in the future

export type SetLike = { reps: number | null; weight: number | null };
export type LoggedExerciseLike = { logged_sets?: SetLike[] | null };
export type WorkoutLogLike = { date: string; logged_exercises?: LoggedExerciseLike[] | null };

function hasValue(value: number | null | undefined): boolean {
  return value !== null && value !== undefined;
}

// Same rule as the logger's own "logged set" test (countLoggedSets in ExerciseLogPanel: reps or
// weight has content), applied to persisted values. A blank placeholder (reps and weight both
// null) is not performed; a recorded 0 is, since it is content the user entered.
export function isPerformedSet(set: SetLike): boolean {
  return hasValue(set.reps) || hasValue(set.weight);
}

export function isPerformedExercise(exercise: LoggedExerciseLike): boolean {
  return (exercise.logged_sets ?? []).some(isPerformedSet);
}

// A performed log dated on or before `todayStr`. Future-dated logs are never workout days.
// Plain yyyy-MM-dd strings compare correctly lexicographically.
export function isWorkoutDay(log: WorkoutLogLike, todayStr: string = today()): boolean {
  if (log.date > todayStr) return false;
  return (log.logged_exercises ?? []).some(isPerformedExercise);
}

export type ExerciseSessionLike = {
  date: string;
  logged_exercises?: (LoggedExerciseLike & { exercise_id: string })[] | null;
};

// A performed SESSION of one specific exercise: a log on or before `todayStr` in which that
// exercise has at least one performed set. Blank-only occurrences and future dates don't count;
// any number of duplicate occurrences on the log still make it one session (this is a per-log
// boolean). The single definition behind both the full-history recurrence (Phase 17) and the
// page-local "sessions shown" summary (Phase 16) — they differ only in which logs they are given.
export function isPerformedExerciseSession(
  log: ExerciseSessionLike,
  exerciseId: string,
  todayStr: string = today()
): boolean {
  if (log.date > todayStr) return false;
  return (log.logged_exercises ?? []).some(
    (le) => le.exercise_id === exerciseId && isPerformedExercise(le)
  );
}

// First date of an inclusive N-calendar-day window ending `todayStr`: N days *including* today,
// so windowStart(1) is today and windowStart(7) is today minus 6 days. Not `today - N`, which
// would span N + 1 days.
export function windowStart(windowDays: number, todayStr: string = today()): string {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError("windowDays must be a positive integer");
  }
  return shiftDate(todayStr, -(windowDays - 1));
}
