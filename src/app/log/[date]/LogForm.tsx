"use client";

import { useEffect, useRef, useState } from "react";
import type { Exercise, WorkoutLog, WorkoutPlan } from "@/lib/types";
import type { PreviousPerformance } from "@/lib/queries";
import { saveLog, fetchPreviousPerformance } from "./actions";
import ExerciseLogPanel, { type ExerciseEntry, type SetRow } from "./ExerciseLogPanel";
import LogExercisePicker from "./LogExercisePicker";

type Props = {
  date: string;
  exercises: Exercise[];
  plan: WorkoutPlan | null;
  existingLog: WorkoutLog | null;
  initialPreviousPerformance: Record<string, PreviousPerformance | null>;
  // False when editing an already-logged historical day: the plan's current targets are not
  // shown, since they may have changed or been deleted since this workout was actually
  // performed (see HistoricalLogView). Defaults to true — today's/in-progress logging is
  // unaffected.
  showTargets?: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 900;

function emptySet(carryForward?: SetRow): SetRow {
  return { reps: "", weight: carryForward?.weight ?? "", weightUnit: carryForward?.weightUnit ?? "kg" };
}

export default function LogForm({
  date,
  exercises,
  plan,
  existingLog,
  initialPreviousPerformance,
  showTargets = true,
}: Props) {
  const targetByExerciseId = new Map(
    showTargets
      ? plan?.planned_exercises?.map((pe) => [pe.exercise_id, { sets: pe.target_sets, reps: pe.target_reps }]) ?? []
      : []
  );

  // The persisted log always wins over the plan seed once it exists — reopening/resuming a
  // session must never quietly revert to the original plan and discard logged progress.
  const initialEntries: ExerciseEntry[] = existingLog?.logged_exercises?.length
    ? existingLog.logged_exercises.map((le) => ({
        exerciseId: le.exercise_id,
        name: le.exercise?.name ?? "Exercise",
        target: targetByExerciseId.get(le.exercise_id) ?? null,
        sets: le.logged_sets?.length
          ? le.logged_sets.map((s) => ({
              reps: s.reps?.toString() ?? "",
              weight: s.weight?.toString() ?? "",
              weightUnit: s.weight_unit,
            }))
          : [emptySet()],
        done: false,
      }))
    : plan?.planned_exercises?.map((pe) => ({
        exerciseId: pe.exercise_id,
        name: pe.exercise?.name ?? "Exercise",
        target: showTargets ? { sets: pe.target_sets, reps: pe.target_reps } : null,
        sets: Array.from({ length: pe.target_sets ?? 3 }, () => emptySet()),
        done: false,
      })) ?? [];

  const [entries, setEntries] = useState<ExerciseEntry[]>(initialEntries);
  const [notes, setNotes] = useState(existingLog?.notes ?? "");
  const [workoutCompleted, setWorkoutCompleted] = useState(!!existingLog?.completed_at);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previousPerformance, setPreviousPerformance] =
    useState<Record<string, PreviousPerformance | null>>(initialPreviousPerformance);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Always-current snapshot for the save routine to read. Updated synchronously by the
  // update* helpers below (never via a useEffect keyed on state) — an effect only runs after
  // React commits the render, which is too late for scheduleSave(true) called in the same
  // handler right after setState: it would read the previous, stale value.
  const stateRef = useRef({ entries, notes, workoutCompleted });

  function updateEntries(updater: (prev: ExerciseEntry[]) => ExerciseEntry[]) {
    const next = updater(stateRef.current.entries);
    stateRef.current = { ...stateRef.current, entries: next };
    setEntries(next);
    return next;
  }

  function updateNotesValue(value: string) {
    stateRef.current = { ...stateRef.current, notes: value };
    setNotes(value);
  }

  function updateCompleted(value: boolean) {
    stateRef.current = { ...stateRef.current, workoutCompleted: value };
    setWorkoutCompleted(value);
  }

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  // True whenever a real edit hasn't been confirmed persisted yet — lets the visibility/pagehide
  // flush skip doing any work at all when there's nothing to save (e.g. just viewing the page).
  const hasUnsavedRef = useRef(false);

  async function doSave() {
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setSaveError(null);

    const snapshot = stateRef.current;
    const result = await saveLog({
      date,
      planId: plan?.id ?? null,
      notes: snapshot.notes,
      completed: snapshot.workoutCompleted,
      exercises: snapshot.entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.map((s) => ({
          reps: s.reps ? parseInt(s.reps, 10) : null,
          weight: s.weight ? parseFloat(s.weight) : null,
          weightUnit: s.weightUnit,
        })),
      })),
    });

    savingRef.current = false;

    if (result.error) {
      setSaveState("error");
      setSaveError(result.error);
      return;
    }

    if (dirtyRef.current) {
      // Newer edits arrived while this request was in flight — persist those too, and only
      // report "Saved" once nothing newer is left to send.
      dirtyRef.current = false;
      void doSave();
      return;
    }
    hasUnsavedRef.current = false;
    setSaveState("saved");
  }

  // Every real edit routes through here (called directly from the mutation handlers below —
  // never from a generic effect watching state, which would also fire on mount/re-render and
  // double-fire under React Strict Mode's dev-only double-invoke).
  function scheduleSave(immediate: boolean) {
    hasUnsavedRef.current = true;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (immediate) {
      void doSave();
    } else {
      debounceTimer.current = setTimeout(() => void doSave(), AUTOSAVE_DEBOUNCE_MS);
    }
  }

  // Flush on visibilitychange (phone lock, app switch, tab switch) — the page is still alive at
  // that point, just hidden, so the in-flight fetch has a real chance to complete. This is the
  // primary defense against losing an unsaved edit and is what the debounce window is backstopped
  // by. No-ops if nothing is actually unsaved, so merely backgrounding the tab never triggers a
  // redundant write.
  //
  // pagehide (actual tab close / navigation away) is best-effort only, not a guarantee: the
  // browser can abort an in-flight, non-keepalive fetch mid-unload, so this attempt may not
  // finish. It's kept as an opportunistic extra chance, not something the save model depends on —
  // visibilitychange already covers the cases that matter (lock/background), since a page is
  // reliably hidden before it can be closed.
  useEffect(() => {
    function flushIfHidden() {
      if (document.hidden && hasUnsavedRef.current) scheduleSave(true);
    }
    function bestEffortFlushOnUnload() {
      if (hasUnsavedRef.current) scheduleSave(true);
    }
    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", bestEffortFlushOnUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", bestEffortFlushOnUnload);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSet(index: number, field: keyof SetRow, value: string) {
    updateEntries((prev) =>
      prev.map((e, i) =>
        i === currentIndex
          ? { ...e, sets: e.sets.map((s, si) => (si === index ? { ...s, [field]: value } : s)) }
          : e
      )
    );
    scheduleSave(false);
  }

  function addSet() {
    updateEntries((prev) =>
      prev.map((e, i) =>
        i === currentIndex ? { ...e, sets: [...e.sets, emptySet(e.sets[e.sets.length - 1])] } : e
      )
    );
    scheduleSave(true);
  }

  function removeSet(index: number) {
    updateEntries((prev) =>
      prev.map((e, i) => (i === currentIndex ? { ...e, sets: e.sets.filter((_, si) => si !== index) } : e))
    );
    scheduleSave(true);
  }

  function toggleDone() {
    const wasDone = entries[currentIndex]?.done;
    updateEntries((prev) => prev.map((e, i) => (i === currentIndex ? { ...e, done: !e.done } : e)));
    scheduleSave(true);
    if (!wasDone && currentIndex < entries.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function removeExercise(index: number) {
    updateEntries((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((i) => Math.max(0, Math.min(i, entries.length - 2)));
    scheduleSave(true);
  }

  async function addExercise(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex || entries.some((e) => e.exerciseId === exerciseId)) return;
    updateEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        name: ex.name,
        target: targetByExerciseId.get(exerciseId) ?? null,
        sets: [emptySet()],
        done: false,
      },
    ]);
    setCurrentIndex(entries.length);
    setPickerOpen(false);
    scheduleSave(true);

    if (!(exerciseId in previousPerformance)) {
      const prev = await fetchPreviousPerformance(exerciseId, date);
      setPreviousPerformance((p) => ({ ...p, [exerciseId]: prev }));
    }
  }

  function goTo(index: number) {
    if (hasUnsavedRef.current) scheduleSave(true);
    setCurrentIndex(index);
  }

  function updateNotes(value: string) {
    updateNotesValue(value);
    scheduleSave(false);
  }

  function finishWorkout() {
    updateCompleted(true);
    scheduleSave(true);
  }

  function reopenWorkout() {
    updateCompleted(false);
    scheduleSave(true);
  }

  const current = entries[currentIndex];
  const completedCount = entries.filter((e) => e.done).length;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <SaveStatus state={saveState} error={saveError} onRetry={() => scheduleSave(true)} />

      {workoutCompleted && (
        <div className="rounded-xl border border-green-900 bg-green-950/40 px-4 py-2.5">
          <p className="text-sm font-medium text-green-400">Workout completed ✓</p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>
              {completedCount} of {entries.length} exercise{entries.length === 1 ? "" : "s"} done
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {entries.map((e, i) => (
              <button
                key={e.exerciseId}
                type="button"
                onClick={() => goTo(i)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  i === currentIndex ? "bg-neutral-800 text-neutral-100" : "text-neutral-400"
                }`}
              >
                <span className="w-4">{e.done ? "✓" : i === currentIndex ? "→" : ""}</span>
                {e.name}
              </button>
            ))}
          </div>

          {current && (
            <ExerciseLogPanel
              entry={current}
              positionLabel={`Exercise ${currentIndex + 1} of ${entries.length}`}
              previous={previousPerformance[current.exerciseId]}
              onUpdateSet={updateSet}
              onAddSet={addSet}
              onRemoveSet={removeSet}
              onToggleDone={toggleDone}
              onRemoveExercise={() => removeExercise(currentIndex)}
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => goTo(Math.min(entries.length - 1, currentIndex + 1))}
              disabled={currentIndex === entries.length - 1}
              className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </>
      )}

      {entries.length === 0 && !pickerOpen && (
        <p className="text-sm text-neutral-500">
          No exercises yet — add one below, or set up a schedule for this day first.
        </p>
      )}

      {pickerOpen ? (
        <LogExercisePicker
          exercises={exercises}
          alreadyAdded={new Set(entries.map((e) => e.exerciseId))}
          onAdd={addExercise}
          onCancel={() => setPickerOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100"
        >
          + Add exercise
        </button>
      )}

      <textarea
        value={notes}
        onChange={(e) => updateNotes(e.target.value)}
        placeholder="Notes (how did it feel?)"
        rows={3}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      {workoutCompleted ? (
        <button
          type="button"
          onClick={reopenWorkout}
          className="rounded-xl border border-neutral-700 px-4 py-3 font-medium text-neutral-100"
        >
          Reopen workout
        </button>
      ) : (
        <button
          type="button"
          onClick={finishWorkout}
          className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900"
        >
          Finish workout
        </button>
      )}
    </div>
  );
}

function SaveStatus({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
}) {
  if (state === "idle") return null;

  if (state === "error") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-900 bg-red-950/40 px-3 py-2">
        <p className="text-sm text-red-400">{error ?? "Couldn't save — your changes are kept here."}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-red-800 px-3 py-1 text-xs font-medium text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <p className="text-xs text-neutral-500">
      {state === "saving" ? "Saving…" : "Saved"}
    </p>
  );
}
