"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import ExerciseTutorialPanel from "@/components/exercise-library/ExerciseTutorialPanel";
import ExerciseSwapPanel from "./ExerciseSwapPanel";
import type { SwapOption } from "@/lib/exerciseSwap";
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
import {
  distanceProblem,
  durationProblem,
  formatDuration,
  formatPace,
  formatSetValue,
  parseDuration,
  type DistanceUnit,
  type Measure,
} from "@/lib/measure";

// rpe is "" when not recorded. done is the on-screen ✓ (it starts the rest timer); it is not saved.
// duration is typed text ("45", "1:30"); distance is a number as typed. Which fields a row shows
// depends on the exercise's measure (lib/measure.ts).
export type SetRow = {
  reps: string;
  weight: string;
  weightUnit: string;
  setType: SetType;
  rpe: string;
  duration: string;
  distance: string;
  distanceUnit: DistanceUnit;
  done?: boolean;
};
export type ExerciseEntry = {
  exerciseId: string;
  name: string;
  // How the exercise is measured: which fields its set rows show.
  measure: Measure;
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
    // Only like with like: a working set is never compared with last session's warm-up (or drop set).
    if (!previousSet || toSetType(previousSet.setType) !== toSetType(set.setType)) return null;

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

// One of last time's sets in words, with the pace for a distance and time ("5 km in 28:30 · 5:42 /km").
export function lastTimeValue(set: PreviousPerformance["sets"][number]): string {
  const pace = formatPace(set.distance ?? null, set.durationSeconds ?? null, set.distanceUnit ?? "km");
  return pace ? `${formatSetValue(set)} · ${pace}` : formatSetValue(set);
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
      duration: s.durationSeconds != null ? formatDuration(s.durationSeconds) : "",
      distance: s.distance != null ? String(s.distance) : "",
      distanceUnit: s.distanceUnit === "mi" ? "mi" : "km",
    }));
}

// A row with anything recorded in it: reps, weight, a time or a distance.
export function setHasValues(set: Pick<SetRow, "reps" | "weight"> & Partial<Pick<SetRow, "duration" | "distance">>): boolean {
  return !!(set.reps.trim() || set.weight.trim() || set.duration?.trim() || set.distance?.trim());
}

// A row as the server saves it. Blank fields are null; a time that can't be read is null too
// (setValueProblem already says so beside the set).
export function toSavedSet(set: SetRow) {
  const seconds = parseDuration(set.duration);
  return {
    reps: set.reps ? parseInt(set.reps, 10) : null,
    weight: set.weight ? parseFloat(set.weight) : null,
    weightUnit: set.weightUnit,
    setType: set.setType,
    rpe: set.rpe ? parseFloat(set.rpe) : null,
    durationSeconds: seconds === null || Number.isNaN(seconds) ? null : seconds,
    distance: set.distance ? parseFloat(set.distance) : null,
    distanceUnit: set.distanceUnit,
  };
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
  // Replaces this exercise with another that does the same job; offered until a set is entered.
  onSwapExercise: (option: SwapOption) => void;
  // The workout's other exercises, which Swap doesn't offer.
  otherExerciseIds: string[];
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
  if (!target.reps && !target.weight) return `${sets} set${sets === 1 ? "" : "s"}`;
  const reps = target.reps ?? "?";
  const weight = target.weight ? ` @ ${target.weight} ${target.weightUnit ?? "kg"}` : "";
  return `${sets} × ${reps}${weight}`;
}

export const CURRENT_EXERCISE_TITLE_ID = "current-exercise-title";

export function setCountLabel(count: number): string {
  return count === 1 ? "1 set" : `${count} sets`;
}

// What's wrong with a set's numbers, in the same limits the server saves by. One bad number stops
// the whole workout saving, so it's said beside the set rather than only at the top of the page.
export function setValueProblem(
  set: Pick<SetRow, "weight" | "reps"> & Partial<Pick<SetRow, "duration" | "distance">>
): string | null {
  const duration = durationProblem(set.duration ?? "");
  if (duration) return `${duration} This set isn't saved yet.`;
  const distance = distanceProblem(set.distance ?? "");
  if (distance) return `${distance} This set isn't saved yet.`;
  if (set.weight.trim()) {
    const weight = parseFloat(set.weight);
    if (!(weight >= 0 && weight <= 1000)) return "Enter a weight between 0 and 1000. This set isn't saved yet.";
  }
  if (set.reps.trim()) {
    const reps = parseInt(set.reps, 10);
    if (!(reps >= 0 && reps <= 1000)) return "Enter reps between 0 and 1000. This set isn't saved yet.";
  }
  return null;
}

// Where to look when a workout can't save because of a number: the first exercise holding one.
export function firstEntryWithSetProblem(
  entries: { sets: (Pick<SetRow, "weight" | "reps"> & Partial<Pick<SetRow, "duration" | "distance">>)[] }[]
): number {
  return entries.findIndex((entry) => entry.sets.some((set) => setValueProblem(set)));
}

// Removing an exercise deletes its sets too, so it asks first once anything has been entered.
function hasEnteredData(sets: SetRow[]): boolean {
  return sets.some((set) => setHasValues(set) || set.rpe.trim() || set.done);
}

// A set counts as logged once it has recorded content (reps, weight, time or distance) — a freshly plan-seeded
// row present in the array but still blank does not count. Mirrors LogForm's isExerciseEntryLogged
// at set granularity, so a plan targeting 3 sets doesn't read as "3 logged" the moment the stepper
// pre-populates 3 empty rows, before the user has entered anything.
export function countLoggedSets(sets: SetRow[]): number {
  return sets.filter((s) => setHasValues(s)).length;
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
  onSwapExercise,
  otherExerciseIds,
  onCopyPrevious,
  onUpdateNotes,
  onToggleSetDone,
}: Props) {
  const [showPlates, setShowPlates] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const swapPanelId = useId();
  // Logged sets belong to the exercise they were done on, so Swap is only offered before any.
  const canSwap = !hasEnteredData(entry.sets);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Adding or removing a set is otherwise silent, and removing one takes the focused button with it.
  const [setsAnnouncement, setSetsAnnouncement] = useState("");
  const addSetButtonRef = useRef<HTMLButtonElement>(null);
  // The set whose tick was tapped with nothing in it: only filled-in sets are saved.
  const [blankTick, setBlankTick] = useState<string | null>(null);
  const tutorialPanelId = useId();
  const canCopyPrevious = !!previous && previous.sets.length > 0 && countLoggedSets(entry.sets) === 0;
  const target = targetLabel(entry.target);
  const comparisons = compareSets(entry.sets, previous);
  const remainingPlannedSets = formatRemainingPlannedSets(
    getRemainingPlannedSetCount(entry.target?.sets, countLoggedSets(entry.sets))
  );
  const measure = entry.measure;
  const gridCols = measure === "time" ? "grid-cols-[2rem_1fr_2.5rem]" : "grid-cols-[2rem_1fr_1fr_2.5rem]";

  return (
    <div className="card p-4">
      {/* The actions sit under the name, so a long name and its target keep the full width. */}
      <div className="mb-3 flex flex-col gap-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-label-3">{positionLabel}</p>
          <h2 id={CURRENT_EXERCISE_TITLE_ID} tabIndex={-1} className="text-lg font-semibold break-words outline-none">
            {entry.name}
          </h2>
          <p className="text-sm text-label-2">
            {target ? <>Target {target}</> : "No target set"}
            {remainingPlannedSets && <span className="text-label-3"> · {remainingPlannedSets}</span>}
          </p>
        </div>
        <div className="-ml-2.5 flex items-center">
          <button
            type="button"
            onClick={() => setShowTutorial((value) => !value)}
            aria-expanded={showTutorial}
            aria-controls={tutorialPanelId}
            className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
          >
            {showTutorial ? "Hide how-to" : "How to"}
          </button>
          {canSwap && (
            <button
              type="button"
              onClick={() => setShowSwap((value) => !value)}
              aria-expanded={showSwap}
              aria-controls={swapPanelId}
              className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
            >
              {showSwap ? "Cancel swap" : "Swap"}
            </button>
          )}
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

      {showSwap && canSwap && (
        <div className="mb-3 rounded-lg border border-separator p-3">
          <ExerciseSwapPanel
            key={entry.exerciseId}
            exerciseId={entry.exerciseId}
            excludeIds={otherExerciseIds}
            panelId={swapPanelId}
            onChoose={(option) => {
              setShowSwap(false);
              setShowTutorial(false);
              onSwapExercise(option);
            }}
          />
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
              {previous.sets.map(lastTimeValue).join(", ")}
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
        <div className={`grid ${gridCols} gap-x-2 px-0.5 text-[11px] font-medium text-label-3`} aria-hidden>
          <span className="text-center">Set</span>
          {measure === "time" ? (
            <span>Time</span>
          ) : measure === "distance" ? (
            <>
              <span>Distance</span>
              <span>Time</span>
            </>
          ) : (
            <>
              <span>Weight</span>
              <span>Reps</span>
            </>
          )}
          <span className="text-center">Done</span>
        </div>
        {entry.sets.map((set, i) => {
          const comparisonText = formatSetComparison(comparisons[i]);
          const plates = showPlates && measure === "weight_reps" ? plateText(set) : null;
          const problem = setValueProblem(set);
          const blank = !setHasValues(set);
          const pace = measure === "distance" ? formatPace(parseFloat(set.distance), parseDuration(set.duration), set.distanceUnit) : null;
          return (
            <div
              key={i}
              className={`rounded-lg px-0.5 py-1 transition-colors ${set.done ? "bg-green/8" : ""}`}
            >
              <div className={`grid ${gridCols} items-center gap-x-2`}>
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
                {measure === "time" ? (
                  <DurationInput value={set.duration} onChange={(v) => onUpdateSet(i, "duration", v)} label={`Set ${i + 1} time`} />
                ) : measure === "distance" ? (
                  <>
                    <div className={UNIT_FIELD}>
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        placeholder="0"
                        value={set.distance}
                        onChange={(e) => onUpdateSet(i, "distance", e.target.value)}
                        aria-label={`Set ${i + 1} distance`}
                        className="h-full w-full min-w-0 bg-transparent pl-2.5 text-base tabular-nums outline-none placeholder:text-label-3"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateSet(i, "distanceUnit", set.distanceUnit === "km" ? "mi" : "km")}
                        aria-label={`Unit: ${set.distanceUnit}. Switch to ${set.distanceUnit === "km" ? "mi" : "km"}`}
                        className="mr-1 h-7 shrink-0 rounded-md px-1.5 text-xs font-semibold text-label-2 hover:bg-fill"
                      >
                        {set.distanceUnit}
                      </button>
                    </div>
                    <DurationInput value={set.duration} onChange={(v) => onUpdateSet(i, "duration", v)} label={`Set ${i + 1} time`} />
                  </>
                ) : (
                  <>
                    {/* The same focus ring as the other fields (.field:focus), drawn around the whole box. */}
                    <div className="field flex h-10 items-center rounded-lg focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]">
                      <input
                        type="number"
                        min="0"
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
                      min="0"
                      inputMode="numeric"
                      placeholder="0"
                      value={set.reps}
                      onChange={(e) => onUpdateSet(i, "reps", e.target.value)}
                      aria-label={`Set ${i + 1} reps`}
                      className="field h-10 w-full min-w-0 rounded-lg px-2.5 text-base tabular-nums"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    if (blank && !set.done) {
                      setBlankTick(`${entry.exerciseId}:${i}`);
                      e.currentTarget.parentElement?.querySelector("input")?.focus();
                      return;
                    }
                    onToggleSetDone(i);
                  }}
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
                {comparisonText && !problem && (
                  <p className="min-w-0 flex-1 text-xs text-label-2">{comparisonText}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onRemoveSet(i);
                    setSetsAnnouncement(`Set ${i + 1} removed`);
                    requestAnimationFrame(() => addSetButtonRef.current?.focus());
                  }}
                  aria-label={`Remove set ${i + 1}`}
                  className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-label-3 hover:bg-fill hover:text-red"
                >
                  <Icon name="close" className="size-4" strokeWidth={2} />
                </button>
              </div>
              {plates && <p className="pl-10 text-xs text-orange">{plates}</p>}
              {pace && !problem && <p className="pl-10 text-xs text-label-2">Pace {pace}</p>}
              {problem && (
                <p role="alert" className="pl-10 text-xs text-red">
                  {problem}
                </p>
              )}
              {blank && !set.done && blankTick === `${entry.exerciseId}:${i}` && (
                <p role="alert" className="pl-10 text-xs text-red">
                  {measure === "time"
                    ? "Enter the time first, so this set is saved."
                    : measure === "distance"
                      ? "Enter the distance or time first, so this set is saved."
                      : "Enter the weight or reps first, so this set is saved."}
                </p>
              )}
            </div>
          );
        })}

        <p role="status" className="sr-only">
          {setsAnnouncement}
        </p>
        <div className="flex items-center gap-2">
          <button
            ref={addSetButtonRef}
            type="button"
            onClick={() => {
              onAddSet();
              setSetsAnnouncement(`Set ${entry.sets.length + 1} added`);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-separator px-3 text-sm font-medium text-label-2 hover:bg-fill hover:text-label"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.25} />
            Add set
          </button>
          {measure === "weight_reps" && (
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
          )}
        </div>
        <p className="text-xs text-label-3">
          {showPlates && measure === "weight_reps" ? "Plates per side on a 20 kg / 45 lb bar. " : ""}
          {measure === "time" ? "Type a time like 45 (seconds) or 1:30. " : measure === "distance" ? "Time like 28:30 or 1:05:00. " : ""}Tap a set number to mark it warm-up (W), drop
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

// A box with a unit button inside it (kg/lb, km/mi), with the same focus ring as other fields.
const UNIT_FIELD =
  "field flex h-10 items-center rounded-lg focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]";

// A time typed as seconds ("45") or a clock time ("1:30", "1:02:30").
function DurationInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder="0:45"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="field h-10 w-full min-w-0 rounded-lg px-2.5 text-base tabular-nums"
    />
  );
}
