"use client";

import Link from "next/link";
import type { PreviousPerformance } from "@/lib/queries";
import { compareSet, type SetComparison, type ValueComparison } from "@/lib/analyze/setComparison";

export type SetRow = { reps: string; weight: string; weightUnit: string };
export type ExerciseEntry = {
  exerciseId: string;
  name: string;
  target: { sets: number | null; reps: number | null } | null;
  sets: SetRow[];
  done: boolean;
};

export type { ValueComparison, SetComparison };

// Strict same-set-number matching only: a current set is compared against the previous session's
// set with the identical set_number, never by array position. Weight and reps are evaluated
// independently so a missing/mismatched value on one never suppresses a valid comparison on the
// other. Current sets aren't persisted yet, so their eventual set_number is derived the same way
// save_workout_log assigns it — array index + 1 (see log/[date]/actions.ts's saveLog mapping).
// The arithmetic itself lives in lib/analyze/setComparison.ts, shared with the exercise History.
export function compareSets(
  currentSets: SetRow[],
  previous: PreviousPerformance | null | undefined
): (SetComparison | null)[] {
  return currentSets.map((set, index) => {
    const setNumber = index + 1;
    const previousSet = previous?.sets.find((s) => s.setNumber === setNumber);
    if (!previousSet) return null;

    const currentWeight = set.weight ? parseFloat(set.weight) : null;
    const currentReps = set.reps ? parseInt(set.reps, 10) : null;

    return compareSet(
      { reps: currentReps, weight: currentWeight, weightUnit: set.weightUnit },
      { reps: previousSet.reps, weight: previousSet.weight, weightUnit: previousSet.weightUnit }
    );
  });
}

function formatWeightComparison(c: ValueComparison): string | null {
  if (c.type === "unavailable") return null;
  if (c.type === "same") return "same weight as last time";
  const sign = c.delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(c.delta)} ${c.unit} vs last time`;
}

function formatRepsComparison(c: ValueComparison): string | null {
  if (c.type === "unavailable") return null;
  if (c.type === "same") return "same reps as last time";
  const sign = c.delta > 0 ? "+" : "−";
  const n = Math.abs(c.delta);
  return `${sign}${n} rep${n === 1 ? "" : "s"} vs last time`;
}

// Descriptive only — reports the arithmetic difference, never a judgment. Returns null when
// there's nothing to say (no matching previous set, or both values unavailable/mismatched).
export function formatSetComparison(comparison: SetComparison | null): string | null {
  if (comparison === null) return null;
  const parts = [formatWeightComparison(comparison.weight), formatRepsComparison(comparison.reps)].filter(
    (p): p is string => p !== null
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

type Props = {
  entry: ExerciseEntry;
  positionLabel: string;
  previous: PreviousPerformance | null | undefined; // undefined = still loading
  onUpdateSet: (index: number, field: keyof SetRow, value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onToggleDone: () => void;
  onRemoveExercise: () => void;
};

// Reuses the existing exercise-filtered History view (see history/page.tsx + ExerciseFilter) —
// no new route, no redesign, just a contextual link into what's already there.
export function exerciseHistoryHref(exerciseId: string): string {
  return `/history?exercise=${exerciseId}`;
}

function targetLabel(target: ExerciseEntry["target"]): string | null {
  if (!target || (!target.sets && !target.reps)) return null;
  const sets = target.sets ?? "?";
  const reps = target.reps ?? "?";
  return `${sets} × ${reps}`;
}

// A set counts as logged once it has recorded content (reps or weight) — a freshly plan-seeded
// row present in the array but still blank does not count. Mirrors LogForm's isExerciseEntryLogged
// at set granularity, so a plan targeting 3 sets doesn't read as "3 logged" the moment the stepper
// pre-populates 3 empty rows, before the user has entered anything.
export function countLoggedSets(sets: SetRow[]): number {
  return sets.filter((s) => s.reps.trim() !== "" || s.weight.trim() !== "").length;
}

// Purely descriptive: how many more planned sets remain unlogged, based only on the literal
// count of sets with recorded content vs. target_sets — never reps/weight magnitude, never a
// judgment. Returns null (nothing to show) when there's no usable target, or once the logged
// count meets or exceeds it — extra sets beyond the target are never flagged.
export function getRemainingPlannedSetCount(
  targetSets: number | null | undefined,
  loggedSetCount: number
): number | null {
  if (targetSets === null || targetSets === undefined) return null;
  if (!Number.isFinite(targetSets) || targetSets <= 0) return null;
  const remaining = targetSets - loggedSetCount;
  return remaining > 0 ? remaining : null;
}

// Descriptive-only wording, deliberately not "X of Y" / fraction / percentage — see Phase 15 scope.
export function formatRemainingPlannedSets(remaining: number | null): string | null {
  if (remaining === null) return null;
  return `${remaining} planned set${remaining === 1 ? "" : "s"} not yet logged`;
}

export default function ExerciseLogPanel({
  entry,
  positionLabel,
  previous,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onToggleDone,
  onRemoveExercise,
}: Props) {
  const target = targetLabel(entry.target);
  const comparisons = compareSets(entry.sets, previous);
  const remainingPlannedSets = formatRemainingPlannedSets(
    getRemainingPlannedSetCount(entry.target?.sets, countLoggedSets(entry.sets))
  );

  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">{positionLabel}</p>
          <h2 className="text-lg font-semibold text-neutral-100">{entry.name}</h2>
          <Link href={exerciseHistoryHref(entry.exerciseId)} className="text-xs text-neutral-500 underline">
            View history
          </Link>
        </div>
        <button type="button" onClick={onRemoveExercise} className="text-xs text-red-400">
          Remove
        </button>
      </div>

      {target && (
        <p className="mb-1 text-sm text-neutral-400">
          Target: <span className="text-neutral-200">{target}</span>
        </p>
      )}

      {remainingPlannedSets && (
        <p className="mb-3 text-xs text-neutral-500">{remainingPlannedSets}</p>
      )}

      {previous === undefined ? (
        <p className="mb-3 text-xs text-neutral-600">Loading last time…</p>
      ) : previous ? (
        <div className="mb-3 rounded-lg bg-neutral-900 px-3 py-2">
          <p className="text-xs font-medium text-neutral-400">Last time</p>
          <p className="text-sm text-neutral-200">
            {previous.sets
              .map((s) => `${s.weight ?? "?"}${s.weightUnit} × ${s.reps ?? "?"}`)
              .join(", ")}
          </p>
        </div>
      ) : (
        <p className="mb-3 text-xs text-neutral-600">No previous record for this exercise yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {entry.sets.map((set, i) => {
          const comparisonText = formatSetComparison(comparisons[i]);
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-5 text-sm text-neutral-500">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="weight"
                  value={set.weight}
                  onChange={(e) => onUpdateSet(i, "weight", e.target.value)}
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
                />
                <select
                  value={set.weightUnit}
                  onChange={(e) => onUpdateSet(i, "weightUnit", e.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
                <span className="text-neutral-500">×</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={set.reps}
                  onChange={(e) => onUpdateSet(i, "reps", e.target.value)}
                  className="w-16 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
                />
                <button
                  type="button"
                  onClick={() => onRemoveSet(i)}
                  aria-label={`Remove set ${i + 1}`}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400"
                >
                  ✕
                </button>
              </div>
              {comparisonText && (
                <p className="pl-7 text-xs text-neutral-500">{comparisonText}</p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddSet}
          className="self-start rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-100"
        >
          + Add set
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleDone}
        className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
          entry.done
            ? "border border-neutral-700 text-neutral-300"
            : "bg-white text-neutral-900"
        }`}
      >
        {entry.done ? "Undo complete" : "✓ Complete exercise"}
      </button>
    </div>
  );
}
