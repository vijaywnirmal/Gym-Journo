"use client";

import Link from "next/link";
import { useId, useState } from "react";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import ExerciseTutorialPanel from "@/components/exercise-library/ExerciseTutorialPanel";
import { calculatePlates, formatPlates, isPlateUnit } from "@/lib/plates";
import {
  MAX_EXERCISE_NOTE_LENGTH,
  nextSetType,
  RPE_OPTIONS,
  SET_TYPE_BADGE,
  SET_TYPE_LABEL,
  toSetType,
  type SetType,
} from "@/lib/setData";
import type { PreviousPerformance } from "@/lib/queries";
import { compareSet, type SetComparison, type ValueComparison } from "@/lib/analyze/setComparison";

// rpe is "" when not recorded. done is the on-screen ✓ (it starts the rest timer); it is not saved.
export type SetRow = {
  reps: string;
  weight: string;
  weightUnit: string;
  setType: SetType;
  rpe: string;
  done?: boolean;
};
export type ExerciseEntry = {
  exerciseId: string;
  name: string;
  notes: string;
  // The plan's target; weight is left out of a lighter session, which lightens the load.
  target: { sets: number | null; reps: number | null; weight?: number | null; weightUnit?: string } | null;
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

// "Same as last time": the previous session's performed sets as editable rows, in set order.
// Missing values stay blank rather than becoming "0".
export function setsFromPrevious(previous: PreviousPerformance | null | undefined): SetRow[] {
  if (!previous) return [];
  return [...previous.sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({
      reps: s.reps?.toString() ?? "",
      weight: s.weight?.toString() ?? "",
      weightUnit: s.weightUnit,
      setType: toSetType(s.setType),
      // Effort is about today, so it is never copied.
      rpe: "",
    }));
}

// Per-side plate breakdown for one set row, or null when there's nothing to load (no weight, not
// above the empty bar, or an unknown unit).
export function plateText(set: SetRow): string | null {
  const weight = parseFloat(set.weight);
  if (!isPlateUnit(set.weightUnit)) return null;
  const load = calculatePlates(weight, set.weightUnit);
  if (!load || load.perSide.length === 0) return null;
  const leftover = load.remainder > 0 ? ` (${load.loaded} ${set.weightUnit} loaded, ${load.remainder} short)` : "";
  return `Per side: ${formatPlates(load.perSide)}${leftover}`;
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
  onCopyPrevious: () => void;
  onUpdateNotes: (value: string) => void;
  onToggleSetDone: (index: number) => void;
};

// Reuses the existing exercise-filtered History view (see history/page.tsx + ExerciseFilter) —
// no new route, no redesign, just a contextual link into what's already there.
export function exerciseHistoryHref(exerciseId: string): string {
  return `/history?exercise=${exerciseId}`;
}

function targetLabel(target: ExerciseEntry["target"]): string | null {
  if (!target || (!target.sets && !target.reps && !target.weight)) return null;
  const sets = target.sets ?? "?";
  const reps = target.reps ?? "?";
  const weight = target.weight ? ` @ ${target.weight} ${target.weightUnit ?? "kg"}` : "";
  return `${sets} × ${reps}${weight}`;
}

// Removing an exercise deletes its sets too, so it asks first once anything has been entered.
function hasEnteredData(sets: SetRow[]): boolean {
  return sets.some((set) => set.weight.trim() || set.reps.trim() || set.rpe.trim() || set.done);
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
  onCopyPrevious,
  onUpdateNotes,
  onToggleSetDone,
}: Props) {
  const [showPlates, setShowPlates] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const tutorialPanelId = useId();
  const canCopyPrevious = !!previous && previous.sets.length > 0 && countLoggedSets(entry.sets) === 0;
  const target = targetLabel(entry.target);
  const comparisons = compareSets(entry.sets, previous);
  const remainingPlannedSets = formatRemainingPlannedSets(
    getRemainingPlannedSetCount(entry.target?.sets, countLoggedSets(entry.sets))
  );

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-label-3">{positionLabel}</p>
          <h2 className="truncate text-lg font-semibold">{entry.name}</h2>
          <p className="text-sm text-label-2">
            {target ? <>Target {target}</> : "No target set"}
            {remainingPlannedSets && <span className="text-label-3"> · {remainingPlannedSets}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setShowTutorial((value) => !value)}
            aria-expanded={showTutorial}
            aria-controls={tutorialPanelId}
            className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
          >
            {showTutorial ? "Hide how-to" : "How to"}
          </button>
          <Link
            href={exerciseHistoryHref(entry.exerciseId)}
            className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
          >
            History
          </Link>
          <button
            type="button"
            onClick={() => (hasEnteredData(entry.sets) ? setConfirmingRemove(true) : onRemoveExercise())}
            aria-label={`Remove ${entry.name} from this workout`}
            className="grid size-8 place-items-center rounded-lg text-label-3 hover:bg-fill hover:text-red"
          >
            <Icon name="trash" className="size-[18px]" />
          </button>
        </div>
      </div>

      {confirmingRemove && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-red/30 bg-red/5 p-3">
          <p className="mr-auto text-sm">Remove {entry.name} and its sets from this workout?</p>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="h-8 rounded-lg border border-separator px-3 text-sm font-medium hover:bg-fill"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingRemove(false);
              onRemoveExercise();
            }}
            className="h-8 rounded-lg bg-red px-3 text-sm font-semibold text-white"
          >
            Remove
          </button>
        </div>
      )}

      {showTutorial && (
        <div className="mb-3 rounded-lg border border-separator p-3">
          <ExerciseTutorialPanel key={entry.exerciseId} exerciseId={entry.exerciseId} panelId={tutorialPanelId} />
        </div>
      )}

      {previous === undefined ? (
        <div className="skeleton mb-3 h-11" aria-label="Loading last time" />
      ) : previous ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-fill px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-label-3">Last time</p>
            <p className="truncate text-sm tabular-nums">
              {previous.sets
                .map((s) => `${s.weight ?? "?"}${s.weightUnit} × ${s.reps ?? "?"}`)
                .join(", ")}
            </p>
          </div>
          {canCopyPrevious && (
            <button
              type="button"
              onClick={onCopyPrevious}
              className="h-8 shrink-0 rounded-lg bg-surface px-3 text-xs font-semibold text-link shadow-sm hover:bg-fill"
            >
              Repeat
            </button>
          )}
        </div>
      ) : (
        <p className="mb-3 text-xs text-label-3">First time logging this exercise.</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-x-2 px-0.5 text-[11px] font-medium text-label-3" aria-hidden>
          <span className="text-center">Set</span>
          <span>Weight</span>
          <span>Reps</span>
          <span className="text-center">Done</span>
        </div>
        {entry.sets.map((set, i) => {
          const comparisonText = formatSetComparison(comparisons[i]);
          const plates = showPlates ? plateText(set) : null;
          return (
            <div
              key={i}
              className={`rounded-lg px-0.5 py-1 transition-colors ${set.done ? "bg-green/8" : ""}`}
            >
              <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-x-2">
                <button
                  type="button"
                  onClick={() => onUpdateSet(i, "setType", nextSetType(set.setType))}
                  aria-label={`Set ${i + 1}: ${SET_TYPE_LABEL[set.setType]}. Change set type`}
                  title={`${SET_TYPE_LABEL[set.setType]} — tap to change`}
                  className={`h-8 rounded-md text-sm font-semibold tabular-nums ${
                    SET_TYPE_BADGE[set.setType] ? "bg-orange/12 text-orange" : "text-label-2 hover:bg-fill"
                  }`}
                >
                  {SET_TYPE_BADGE[set.setType] ?? i + 1}
                </button>
                <div className="field flex h-10 items-center rounded-lg focus-within:border-accent">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={set.weight}
                    onChange={(e) => onUpdateSet(i, "weight", e.target.value)}
                    aria-label={`Set ${i + 1} weight`}
                    className="h-full w-full min-w-0 bg-transparent pl-2.5 text-base tabular-nums outline-none placeholder:text-label-3"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateSet(i, "weightUnit", set.weightUnit === "kg" ? "lb" : "kg")}
                    aria-label={`Unit: ${set.weightUnit}. Switch to ${set.weightUnit === "kg" ? "lb" : "kg"}`}
                    className="mr-1 h-7 shrink-0 rounded-md px-1.5 text-xs font-semibold text-label-2 hover:bg-fill"
                  >
                    {set.weightUnit}
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={set.reps}
                  onChange={(e) => onUpdateSet(i, "reps", e.target.value)}
                  aria-label={`Set ${i + 1} reps`}
                  className="field h-10 w-full min-w-0 rounded-lg px-2.5 text-base tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => onToggleSetDone(i)}
                  aria-pressed={!!set.done}
                  aria-label={set.done ? `Set ${i + 1} done. Undo` : `Mark set ${i + 1} done and start rest`}
                  className={`grid size-10 place-items-center rounded-lg border ${
                    set.done
                      ? "border-transparent bg-green text-white"
                      : "border-separator text-label-3 hover:bg-fill hover:text-label-2"
                  }`}
                >
                  <Icon name="checkmark" className="size-5" strokeWidth={2.5} />
                </button>
              </div>
              <div className="mt-1 flex min-h-7 items-center gap-2 pl-10">
                <Select
                  value={set.rpe}
                  onChange={(v) => onUpdateSet(i, "rpe", v)}
                  ariaLabel={`Set ${i + 1} effort (RPE)`}
                  size="sm"
                  className="h-7 w-[5.5rem] text-xs"
                  options={[
                    { value: "", label: "RPE –" },
                    ...RPE_OPTIONS.map((r) => ({ value: String(r), label: `RPE ${r}` })),
                  ]}
                />
                {comparisonText && <p className="min-w-0 flex-1 truncate text-xs text-label-2">{comparisonText}</p>}
                <button
                  type="button"
                  onClick={() => onRemoveSet(i)}
                  aria-label={`Remove set ${i + 1}`}
                  className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-label-3 hover:bg-fill hover:text-red"
                >
                  <Icon name="close" className="size-4" strokeWidth={2} />
                </button>
              </div>
              {plates && <p className="pl-10 text-xs text-orange">{plates}</p>}
            </div>
          );
        })}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddSet}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-separator px-3 text-sm font-medium text-label-2 hover:bg-fill hover:text-label"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.25} />
            Add set
          </button>
          <button
            type="button"
            onClick={() => setShowPlates((v) => !v)}
            aria-pressed={showPlates}
            className={`ml-auto h-8 rounded-lg px-2.5 text-xs font-medium ${
              showPlates ? "bg-fill text-label" : "text-label-2 hover:bg-fill"
            }`}
          >
            Plate math
          </button>
        </div>
        <p className="text-xs text-label-3">
          {showPlates ? "Plates per side on a 20 kg / 45 lb bar. " : ""}Tap a set number to mark it warm-up (W), drop
          (D) or to failure (F).
        </p>
      </div>

      <textarea
        value={entry.notes}
        onChange={(e) => onUpdateNotes(e.target.value)}
        maxLength={MAX_EXERCISE_NOTE_LENGTH}
        placeholder="Note (seat height, grip…)"
        rows={1}
        aria-label={`Note for ${entry.name}`}
        className="field mt-3 w-full resize-none rounded-lg px-3 py-2 text-sm field-sizing-content"
      />

      <button
        type="button"
        onClick={onToggleDone}
        className={`mt-4 h-11 w-full rounded-[10px] px-4 text-[15px] font-semibold ${
          entry.done
            ? "border border-separator text-label-2 hover:bg-fill"
            : "bg-accent text-on-accent hover:bg-accent-hover"
        }`}
      >
        {entry.done ? "Mark as not done" : "Finish exercise"}
      </button>
    </div>
  );
}
