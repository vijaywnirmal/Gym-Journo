import { toKg } from "@/lib/units";
import type { ExerciseSession } from "./exerciseSessions";

// Longitudinal progress facts for one exercise, built from the same performed-session history as
// History (exerciseSessions.ts) — every weight is normalized to kg first, since logged_sets stores
// weight_unit per set and a session can mix kg and lb entries. Pure — no I/O.

// Epley formula: standard estimate, converges toward the raw weight as reps -> 0 but is not exact
// at reps = 1. Used only to rank/trend effort — never shown to the user as a literal claim about
// what they could lift.
function estimatedOneRepMaxKg(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export type ProgressPoint = { date: string; volumeKg: number; e1rmKg: number | null };

// One point per performed session, oldest first (sessions arrive newest-first from
// buildExerciseSessions/getExerciseSessions). volumeKg is total reps x weight across the session's
// performed sets; e1rmKg is the best single-set estimate, or null if no set has both reps and weight.
export function buildProgressPoints(sessions: ExerciseSession[]): ProgressPoint[] {
  return [...sessions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session) => {
      let volumeKg = 0;
      let bestE1rmKg: number | null = null;
      for (const set of session.sets) {
        if (set.weight === null || set.reps === null) continue;
        const weightKg = toKg(set.weight, set.weightUnit);
        volumeKg += weightKg * set.reps;
        const estimate = estimatedOneRepMaxKg(weightKg, set.reps);
        if (bestE1rmKg === null || estimate > bestE1rmKg) bestE1rmKg = estimate;
      }
      return { date: session.date, volumeKg, e1rmKg: bestE1rmKg };
    });
}

export type HeaviestSet = { weightKg: number; reps: number; date: string };

// The heaviest single set ever performed, by weight; ties broken by more reps. Null if no set has
// both reps and weight recorded.
export function heaviestSet(sessions: ExerciseSession[]): HeaviestSet | null {
  let best: HeaviestSet | null = null;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.weight === null || set.reps === null) continue;
      const weightKg = toKg(set.weight, set.weightUnit);
      if (
        !best ||
        weightKg > best.weightKg ||
        (weightKg === best.weightKg && set.reps > best.reps)
      ) {
        best = { weightKg, reps: set.reps, date: session.date };
      }
    }
  }
  return best;
}

export type BestEstimatedOneRepMax = { e1rmKg: number; date: string };

export function bestEstimatedOneRepMax(sessions: ExerciseSession[]): BestEstimatedOneRepMax | null {
  let best: BestEstimatedOneRepMax | null = null;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.weight === null || set.reps === null) continue;
      const estimate = estimatedOneRepMaxKg(toKg(set.weight, set.weightUnit), set.reps);
      if (!best || estimate > best.e1rmKg) best = { e1rmKg: estimate, date: session.date };
    }
  }
  return best;
}
