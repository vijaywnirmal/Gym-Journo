import { toKg } from "@/lib/units";
import { countsTowardProgress } from "@/lib/setData";
import { isPerformedSet } from "./definitions";

// Figures for a shareable workout summary (M12). Pure. Only performed, non-warm-up sets count, the
// same as progress and records. The "best set" per exercise is the one with the highest estimated
// 1RM (Epley), shown in the unit it was logged in.

export type SummarySourceExercise = {
  name: string;
  sets: { reps: number | null; weight: number | null; weightUnit: string; setType?: string | null }[];
};

export type WorkoutSummary = {
  exerciseCount: number;
  workingSets: number;
  totalVolumeKg: number;
  exercises: { name: string; workingSets: number; best: { weight: number; reps: number; unit: string } | null }[];
};

export function buildWorkoutSummary(exercises: SummarySourceExercise[]): WorkoutSummary {
  let workingSets = 0;
  let totalVolumeKg = 0;
  const rows: WorkoutSummary["exercises"] = [];

  for (const ex of exercises) {
    const working = ex.sets.filter((s) => isPerformedSet(s) && countsTowardProgress(s));
    if (working.length === 0) continue;
    workingSets += working.length;

    let best: { weight: number; reps: number; unit: string; score: number } | null = null;
    for (const s of working) {
      if (s.weight === null || s.reps === null) continue;
      const kg = toKg(s.weight, s.weightUnit);
      totalVolumeKg += kg * s.reps;
      const score = kg * (1 + s.reps / 30);
      if (!best || score > best.score) best = { weight: s.weight, reps: s.reps, unit: s.weightUnit, score };
    }
    rows.push({
      name: ex.name,
      workingSets: working.length,
      best: best && { weight: best.weight, reps: best.reps, unit: best.unit },
    });
  }

  return { exerciseCount: rows.length, workingSets, totalVolumeKg, exercises: rows };
}
