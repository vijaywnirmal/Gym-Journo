import { daysBetween, today } from "@/lib/date";
import { isPerformedExerciseSession, isPerformedSet } from "./definitions";
import { compareSet, type SetComparison } from "./setComparison";

// Longitudinal facts for one exercise, built only from the canonical performed definitions
// (analyze/definitions.ts): a session is a log on or before today where the exercise has at least
// one performed set; only performed sets are kept, each with its own set_number. Blank-only and
// future-dated logs never become sessions. Pure — no I/O, no dependence on pagination.

export type PerformedSet = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: string;
  // "working" | "warmup" | "drop" | "failure"; absent/unknown reads as working (lib/setData.ts).
  setType?: string;
};

export type ExerciseSession = { date: string; sets: PerformedSet[] };

type SetRowLike = {
  set_number: number;
  reps: number | null;
  weight: number | null;
  weight_unit: string;
  set_type?: string | null;
};

export type SessionSourceLog = {
  date: string;
  logged_exercises?:
    | { exercise_id: string; position?: number; logged_sets?: SetRowLike[] | null }[]
    | null;
};

// The performed sets one exercise has on one log, ordered by set_number. If the exercise somehow
// occurs more than once on the log, its occurrences are read in position order and concatenated.
export function performedSetsOf(log: SessionSourceLog, exerciseId: string): PerformedSet[] {
  return (log.logged_exercises ?? [])
    .filter((le) => le.exercise_id === exerciseId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .flatMap((le) => le.logged_sets ?? [])
    .filter(isPerformedSet)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({
      setNumber: s.set_number,
      reps: s.reps,
      weight: s.weight,
      weightUnit: s.weight_unit,
      ...(s.set_type ? { setType: s.set_type } : {}),
    }));
}

// Every performed session of the exercise, newest first, one per date.
export function buildExerciseSessions(
  logs: SessionSourceLog[],
  exerciseId: string,
  todayStr: string = today()
): ExerciseSession[] {
  const byDate = new Map<string, ExerciseSession>();
  for (const log of logs) {
    if (byDate.has(log.date)) continue;
    if (!isPerformedExerciseSession(log, exerciseId, todayStr)) continue;
    byDate.set(log.date, { date: log.date, sets: performedSetsOf(log, exerciseId) });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type SessionSetView = { set: PerformedSet; comparison: SetComparison | null };

export type SessionView = {
  date: string;
  sets: SessionSetView[];
  previousDate: string | null;
  daysSincePrevious: number | null;
};

// Each session compared with the previous *performed* session (the next-older entry, so blank
// sessions in between are already gone). Sets are matched strictly by set_number; a set with no
// same-numbered set in the previous session has no comparison, and a set that only existed in the
// previous session is simply not shown. `sessions` must be the full history, newest first, so a
// session at the edge of a page is still compared with its real (off-page) predecessor.
export function buildSessionViews(sessions: ExerciseSession[]): SessionView[] {
  return sessions.map((session, index) => {
    const previous = sessions[index + 1] ?? null;
    return {
      date: session.date,
      previousDate: previous?.date ?? null,
      daysSincePrevious: previous ? daysBetween(previous.date, session.date) : null,
      sets: session.sets.map((set) => {
        const previousSet = previous?.sets.find((s) => s.setNumber === set.setNumber);
        return { set, comparison: previousSet ? compareSet(set, previousSet) : null };
      }),
    };
  });
}

// The same exclusive date-cursor pagination History has always used (`before` = show strictly
// older sessions), now over performed sessions. Facts about the whole history are computed from
// the full list, never from this page.
export function pageSessionViews(
  views: SessionView[],
  options: { before?: string; pageSize: number }
): { views: SessionView[]; hasMore: boolean } {
  const eligible = options.before ? views.filter((v) => v.date < options.before!) : views;
  return {
    views: eligible.slice(0, options.pageSize),
    hasMore: eligible.length > options.pageSize,
  };
}

type RecentLog = {
  date: string;
  logged_exercises?: {
    exercise_id: string;
    logged_sets?: { reps: number | null; weight: number | null }[] | null;
  }[] | null;
};

// The exercises with at least one performed set on or before `todayStr`, most recently performed
// first, each once. Blank-only occurrences and future dates don't make an exercise "performed".
export function recentPerformedExerciseIds(logs: RecentLog[], todayStr: string = today()): string[] {
  const latestDate = new Map<string, string>();
  for (const log of logs) {
    if (log.date > todayStr) continue;
    for (const le of log.logged_exercises ?? []) {
      if (!(le.logged_sets ?? []).some(isPerformedSet)) continue;
      const seen = latestDate.get(le.exercise_id);
      if (seen === undefined || log.date > seen) latestDate.set(le.exercise_id, log.date);
    }
  }
  return [...latestDate.entries()]
    .sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? 1 : -1))
    .map(([id]) => id);
}
