import { countsTowardProgress } from "@/lib/setData";
import type { ExerciseSession } from "./exerciseSessions";
import { bestEstimatedOneRepMax } from "./progress";

// Adapt (M10): deterministic progressive-overload suggestions for an upcoming planned exercise,
// from the person's own logged sessions. Pure. Rules, not a model — and every suggestion carries
// the exact sets it was derived from, so it can be explained and checked.
//
// Increase — the latest session had at least `targetSets` working sets with reps and weight, and
// the top `targetSets` of them (by weight) all reached `targetReps`: suggest the lightest of those
// weights + one step (2.5 kg / 5 lb).
// Deload — at least 4 sessions, the latest 3 did not beat the best estimated 1RM from before them,
// and the latest session missed the rep target: suggest ~90% of the working weight, rounded to a
// step.
// Otherwise nothing. Warm-ups never count. Mixed units in the deciding sets → nothing (no guessing).

export const WEIGHT_STEP = { kg: 2.5, lb: 5 } as const;
const PLATEAU_SESSIONS = 3;
const DELOAD_FACTOR = 0.9;
const TOLERANCE = 1e-9;

export type PlannedTarget = {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetWeightUnit: string;
};

export type EvidenceSet = { weight: number; reps: number; unit: string };

export type OverloadSuggestion = {
  kind: "increase" | "deload";
  currentWeight: number;
  proposedWeight: number;
  unit: "kg" | "lb";
  evidence: { date: string; sets: EvidenceSet[]; targetSets: number; targetReps: number };
  // Deload only: the best estimated 1RM (in kg) the recent sessions failed to beat.
  plateauBestE1rmKg: number | null;
};

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function suggestOverload(
  target: PlannedTarget,
  sessionsNewestFirst: ExerciseSession[]
): OverloadSuggestion | null {
  const { targetSets, targetReps } = target;
  if (!targetSets || !targetReps || targetSets < 1 || targetReps < 1) return null;
  const latest = sessionsNewestFirst[0];
  if (!latest) return null;

  const working = latest.sets
    .filter((s) => countsTowardProgress(s) && s.reps !== null && s.weight !== null && s.weight > 0)
    .map((s) => ({ weight: s.weight as number, reps: s.reps as number, unit: s.weightUnit }));
  if (working.length < targetSets) return null;

  const top = [...working].sort((a, b) => b.weight - a.weight).slice(0, targetSets);
  const unit = top[0].unit;
  if ((unit !== "kg" && unit !== "lb") || top.some((s) => s.unit !== unit)) return null;
  const step = WEIGHT_STEP[unit];
  const currentWeight = Math.min(...top.map((s) => s.weight));
  const evidence = { date: latest.date, sets: top, targetSets, targetReps };
  const plannedAlready = (w: number) =>
    target.targetWeight !== null && target.targetWeightUnit === unit && Math.abs(target.targetWeight - w) < TOLERANCE;

  if (top.every((s) => s.reps >= targetReps)) {
    const proposedWeight = Math.round((currentWeight + step) * 100) / 100;
    if (target.targetWeight !== null && target.targetWeightUnit === unit && target.targetWeight >= proposedWeight - TOLERANCE) {
      return null; // The plan already asks for at least this much.
    }
    return { kind: "increase", currentWeight, proposedWeight, unit, evidence, plateauBestE1rmKg: null };
  }

  if (sessionsNewestFirst.length > PLATEAU_SESSIONS) {
    const recentBest = bestEstimatedOneRepMax(sessionsNewestFirst.slice(0, PLATEAU_SESSIONS));
    const earlierBest = bestEstimatedOneRepMax(sessionsNewestFirst.slice(PLATEAU_SESSIONS));
    if (recentBest && earlierBest && recentBest.e1rmKg <= earlierBest.e1rmKg + TOLERANCE) {
      const proposedWeight = roundToStep(currentWeight * DELOAD_FACTOR, step);
      if (proposedWeight > 0 && proposedWeight < currentWeight && !plannedAlready(proposedWeight)) {
        return { kind: "deload", currentWeight, proposedWeight, unit, evidence, plateauBestE1rmKg: earlierBest.e1rmKg };
      }
    }
  }
  return null;
}

// Plain-language reason that names the data it came from.
export function explainSuggestion(s: OverloadSuggestion, formatDate: (d: string) => string): string {
  const sets = s.evidence.sets.map((x) => `${x.weight} ${x.unit} × ${x.reps}`).join(", ");
  const when = formatDate(s.evidence.date);
  if (s.kind === "increase") {
    return `On ${when} every working set reached the ${s.evidence.targetReps}-rep target (${sets}). Next step: ${s.proposedWeight} ${s.unit}.`;
  }
  const best = s.plateauBestE1rmKg === null ? "" : ` (${Math.round(s.plateauBestE1rmKg * 10) / 10} kg)`;
  return `Your last ${PLATEAU_SESSIONS} sessions didn't beat your earlier best estimated 1RM${best}, and on ${when} some sets fell short of ${s.evidence.targetReps} reps (${sets}). A lighter session at ${s.proposedWeight} ${s.unit} (about 10% less) can help restart progress.`;
}
