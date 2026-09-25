import { getLogForDate, getPriorExerciseSessions } from "@/lib/queries";
import { isValidIsoDate } from "@/lib/date";
import { workoutImageResponse } from "../workoutImage";
import { buildWorkoutSummary } from "@/lib/analyze/workoutSummary";
import { detectPersonalRecords } from "@/lib/analyze/personalRecords";
import { performedSetsOf } from "@/lib/analyze/exerciseSessions";

// A shareable PNG summary of one of the signed-in person's workouts (M12). Private: it reads only
// the caller's own log (getLogForDate is user-scoped and the proxy requires a session), is never
// cached by shared caches, and there is no public URL — the image is handed to the device's share
// sheet by ShareWorkoutButton.

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidIsoDate(date)) return new Response("Not found", { status: 404 });

  const log = await getLogForDate(date);
  if (!log) return new Response("Not found", { status: 404 });

  const loggedExercises = log.logged_exercises ?? [];
  const summary = buildWorkoutSummary(
    loggedExercises.map((le) => ({
      name: le.exercise?.name ?? "Exercise",
      sets: (le.logged_sets ?? []).map((s) => ({
        reps: s.reps,
        weight: s.weight === null ? null : Number(s.weight),
        weightUnit: s.weight_unit,
        setType: s.set_type,
      })),
    }))
  );
  if (summary.exerciseCount === 0) return new Response("Nothing logged", { status: 404 });

  // Records set in this workout, against everything before it (same rules as the logger).
  const ids = [...new Set(loggedExercises.map((le) => le.exercise_id))];
  const history = (await getPriorExerciseSessions(ids, date)) ?? {};
  const recordCount = ids.reduce((n, id) => {
    const sets = performedSetsOf(
      { date, logged_exercises: loggedExercises.map((le) => ({ ...le, logged_sets: le.logged_sets ?? [] })) },
      id
    );
    return n + detectPersonalRecords(history[id] ?? [], sets).length;
  }, 0);

  return workoutImageResponse({ date, title: log.planTitle ?? "Workout", summary, recordCount });
}
